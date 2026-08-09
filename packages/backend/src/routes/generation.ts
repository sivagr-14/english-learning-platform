import express, { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { GenerationJobService } from "../services/generation-job.service";
import {
  enqueueExtraction,
  generationStageJobId,
  enqueueGenerationResume,
  getGenerationQueue,
} from "../queue/generation.queue";
import { selectGenerationResumeStage } from "../services/generation-recovery.service";
import { database } from "../utils/db";
import { generationWorkerReady } from "../queue/worker-health";
import Busboy from "busboy";
import {
  removeStagedUpload,
  stageUpload,
  UploadValidationError,
  validateStagedFileContent,
  validateUploadMetadata,
} from "../services/staged-upload.service";
import { CandidateReviewService } from "../services/candidate-review.service";
import { configFor, GeminiAdapter, OllamaAdapter } from "../services/ai-provider.service";
import { cancelGeminiBatch, resolveGenerationExecutionMode } from "../services/gemini-batch.service";
import { providerRolloutConfig } from "../services/provider-rollout.service";
import { aggregateGeminiUsage, projectFromObservedAttempts } from "../services/gemini-cost-optimization.service";

const router: Router = express.Router();
const jobService = new GenerationJobService(database);
const reviewService = new CandidateReviewService(database);

// Generation is the expensive path (queues real work, will eventually call
// paid APIs) -- tighter limit than the general control endpoints.
// For local development, allow more requests so the import UI can be tested
// without hitting the rate limiter too aggressively.
const generationLimiter = rateLimit({
  windowMs: 60_000,
  limit: process.env.NODE_ENV === "production" ? 10 : 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Too many import requests. Please wait a moment and try again.",
});

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

/** Public endpoint: lets the frontend check whether AI keys are configured. */
router.get("/config-check", (_req: Request, res: Response) => {
  const primaryKeySet = Boolean(
    process.env.PRIMARY_AI_API_KEY || process.env.GEMINI_API_KEY,
  );
  const escalationKeySet = Boolean(process.env.ESCALATION_AI_API_KEY);
  res.json({
    ...providerRolloutConfig(),
    enabled: primaryKeySet && process.env.GEMINI_ENABLED === "true",
    primaryConfigured: primaryKeySet,
    escalationConfigured: escalationKeySet,
    primaryProvider: process.env.PRIMARY_AI_PROVIDER || "gemini",
    primaryModel: process.env.PRIMARY_AI_MODEL || "gemini-2.5-flash",
    escalationProvider: process.env.ESCALATION_AI_PROVIDER || "gemini",
    escalationModel: process.env.ESCALATION_AI_MODEL || "gemini-2.5-pro",
    ollamaEnabled: process.env.OLLAMA_ENABLED === "true",
    ollamaModel: process.env.OLLAMA_MODEL || "qwen3:14b",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  });
});

router.use(authMiddleware);
router.use(generationLimiter as unknown as express.RequestHandler);

router.post(
  "/provider/test",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const provider = z.enum(["gemini", "ollama"]).parse(req.body?.provider);
      if (provider === "gemini" && process.env.GEMINI_ENABLED !== "true")
        return res.status(409).json({ error: "Gemini is disabled in local configuration." });
      if (provider === "ollama" && process.env.OLLAMA_ENABLED !== "true")
        return res.status(409).json({ error: "Ollama is disabled in local configuration." });
      const result = provider === "ollama"
        ? await new OllamaAdapter().testConnection()
        : await new GeminiAdapter().testConnection();
      res.json({ connected: true, provider, ...result });
    } catch (error) {
      next(error);
    }
  },
);

const CreateJobSchema = z.object({
  sourceName: z.string().min(1).max(255),
  sourceType: z.enum([
    "text",
    "md",
    "html",
    "vtt",
    "pdf",
    "srt",
    "docx",
    "epub",
  ]),
  // ~500 KB of plain text ≈ a 350-page book. Larger uploads should use
  // a multipart file endpoint (Phase 4) rather than a JSON string field.
  sourceContent: z.string().min(1).max(500_000),
  provider: z.enum(["gemini", "ollama"]),
  warningBudgetUsd: z.number().positive().max(100).optional(),
  hardBudgetUsd: z.number().positive().max(100).optional(),
  executionMode: z.enum(["auto", "standard", "batch"]).default("auto"),
}).refine(
  (value) => !value.warningBudgetUsd || !value.hardBudgetUsd || value.warningBudgetUsd <= value.hardBudgetUsd,
  { message: "Warning budget cannot exceed hard budget" },
);

router.post(
  "/jobs",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const requestedProvider = req.body?.provider;
      if (requestedProvider === "gemini" && process.env.GEMINI_ENABLED !== "true")
        return res.status(409).json({ error: "Gemini imports are disabled." });
      if (requestedProvider === "ollama" && process.env.OLLAMA_ENABLED !== "true")
        return res.status(409).json({ error: "Ollama imports are disabled." });
      if (!(await generationWorkerReady())) {
        return res.status(503).json({
          error:
            "Generation worker is unavailable. Restart the app and try again.",
          code: "GENERATION_WORKER_UNAVAILABLE",
        });
      }
      const input = CreateJobSchema.parse(req.body);
      const { job, isNew } = await jobService.create({
        userId: req.userId as string,
        sourceName: input.sourceName,
        sourceType: input.sourceType,
        sourceContent: input.sourceContent,
        warningBudgetUsd: input.warningBudgetUsd,
        hardBudgetUsd: input.hardBudgetUsd,
        executionMode: input.provider === "ollama" ? "standard" : input.executionMode,
        provider: input.provider,
      });

      if (isNew) {
        await enqueueExtraction({
          generationJobId: job.id,
          userId: req.userId as string,
        });
      }

      res.status(isNew ? 201 : 200).json({ job, alreadyExisted: !isNew });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/uploads",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let stagedPath: string | undefined;
    try {
      const provider = z.enum(["gemini", "ollama"]).parse(String(req.header("x-ai-provider") || ""));
      if (provider === "gemini" && process.env.GEMINI_ENABLED !== "true")
        return res.status(409).json({ error: "Gemini imports are disabled." });
      if (provider === "ollama" && process.env.OLLAMA_ENABLED !== "true")
        return res.status(409).json({ error: "Ollama imports are disabled." });
      if (!(await generationWorkerReady()))
        return res.status(503).json({
          error:
            "Generation worker is unavailable. Restart the app and try again.",
          code: "GENERATION_WORKER_UNAVAILABLE",
        });
      if (!req.is("multipart/form-data"))
        return res.status(415).json({
          error: "Use multipart/form-data for file uploads.",
          code: "MULTIPART_REQUIRED",
        });
      const sourceType = String(req.header("x-source-type") || "");
      const expectedHash = req.header("x-content-sha256") || undefined;
      const executionMode = z.enum(["auto", "standard", "batch"]).default("auto").parse(req.header("x-execution-mode") || "auto");
      const busboy = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: 25 * 1024 * 1024, fields: 0 },
      });
      let uploadPromise:
        Promise<Awaited<ReturnType<typeof stageUpload>>> | undefined;
      let sourceName = "";
      let truncated = false;
      busboy.on("file", (_field, stream, info) => {
        sourceName = info.filename;
        validateUploadMetadata(sourceType, sourceName);
        stream.on("limit", () => {
          truncated = true;
        });
        uploadPromise = stageUpload({
          stream,
          ownerId: req.userId as string,
          filename: sourceName,
          sourceType,
          expectedHash,
        });
      });
      await new Promise<void>((resolve, reject) => {
        busboy.once("close", resolve);
        busboy.once("error", reject);
        req.once("aborted", () =>
          reject(
            new UploadValidationError(
              "Upload was interrupted",
              400,
              "UPLOAD_INTERRUPTED",
            ),
          ),
        );
        req.pipe(busboy);
      });
      if (!uploadPromise)
        throw new UploadValidationError(
          "Multipart request did not contain a file",
        );
      const staged = await uploadPromise;
      stagedPath = staged.path;
      if (truncated)
        throw new UploadValidationError(
          "File exceeds the 25 MB limit",
          413,
          "FILE_TOO_LARGE",
        );
      await validateStagedFileContent(staged.path, sourceType);
      const { job, isNew } = await jobService.createFromStagedUpload({
        userId: req.userId as string,
        sourceName,
        sourceType: sourceType as any,
        sourceHash: staged.hash,
        stagedUploadPath: staged.path,
        stagedUploadSize: staged.size,
        executionMode: provider === "ollama" ? "standard" : executionMode,
        provider,
      });
      if (!isNew) await removeStagedUpload(staged.path);
      if (isNew)
        await enqueueExtraction({
          generationJobId: job.id,
          userId: req.userId as string,
        });
      res.status(isNew ? 201 : 200).json({ job, alreadyExisted: !isNew });
    } catch (error) {
      if (stagedPath) await removeStagedUpload(stagedPath);
      if (error instanceof UploadValidationError)
        return res
          .status(error.status)
          .json({ error: error.message, code: error.code });
      next(error);
    }
  },
);

router.post(
  "/jobs/:id/cancel",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const current = await jobService.get(req.userId as string, id);
      if (current.provider_batch_id && !["committed", "failed", "cancelled"].includes(current.status)) {
        await cancelGeminiBatch(configFor("primary"), current.provider_batch_id);
      }
      const job = await jobService.requestCancellation(
        req.userId as string,
        id,
      );
      res.status(202).json({ job });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/jobs",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const jobs = await jobService.list(req.userId as string);
      res.json({ jobs });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/jobs/failed",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const cleared = await jobService.clearFailed(req.userId as string);
      res.json({ cleared });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/jobs/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      await jobService.clearTerminal(req.userId as string, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/jobs/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const job = await jobService.get(req.userId as string, id);
      res.json({ job });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/jobs/:id/candidates",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const result = await reviewService.list(req.userId as string, id, {
        decision:
          typeof req.query.decision === "string"
            ? req.query.decision
            : undefined,
        reviewStatus:
          typeof req.query.reviewStatus === "string"
            ? req.query.reviewStatus
            : undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

const ReviewActionSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["approve", "reject", "correct", "retry"]),
  patch: z.record(z.unknown()).default({}),
  reason: z.string().trim().min(3).max(500),
});

router.post(
  "/jobs/:id/candidates/review",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const input = ReviewActionSchema.parse(req.body);
      res.json(
        await reviewService.act(
          req.userId as string,
          id,
          input.candidateIds,
          input.action,
          input.patch,
          input.reason,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/jobs/:id/resume",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const job = await jobService.get(req.userId as string, id);
      const review = await reviewService.list(req.userId as string, id, {});
      if (review.completionBlocked)
        return res
          .status(409)
          .json({
            error:
              "Resolve every attention-required candidate before resuming.",
          });
      const recovery = await selectGenerationResumeStage(
        database,
        req.userId as string,
        id,
      );
      await database("generation_jobs")
        .where({ id })
        .update({
          status:
            recovery.stage === "extract"
              ? "extracting"
              : recovery.stage === "assess"
                ? "assessing"
                : recovery.stage === "generate"
                  ? "generating"
                  : "validating",
          ...(recovery.progressPatch
            ? { stage_progress: JSON.stringify(recovery.progressPatch) }
            : {}),
          error_message: null,
          terminal_reason: null,
          completed_at: null,
          updated_at: new Date(),
        });
      const delivery = await enqueueGenerationResume(
        recovery.stage,
        { generationJobId: id, userId: req.userId as string },
      );
      res.status(202).json({ resumed: true, stage: recovery.stage, delivery });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * SSE endpoint (I1): streams live stage_progress updates for a generation job.
 * The frontend connects once and receives events until the job reaches a
 * terminal state (committed / failed) or the client disconnects.
 * Poll interval: 2 seconds. No message is sent if progress hasn't changed.
 */
router.get(
  "/jobs/:id/progress",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      // Verify ownership before streaming.
      await jobService.get(req.userId as string, id);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const TERMINAL = new Set(["committed", "failed"]);
      let lastJson = "";

      const send = async () => {
        try {
          const job = await jobService.get(req.userId as string, id);
          const payload = JSON.stringify({
            status: job.status,
            stageProgress: job.stage_progress,
            actualCost: job.actual_cost,
            tokensUsed: job.tokens_used,
          });
          if (payload !== lastJson) {
            res.write(`data: ${payload}\n\n`);
            lastJson = payload;
          }
          if (TERMINAL.has(job.status)) {
            res.write("event: done\ndata: {}\n\n");
            res.end();
            clearInterval(timer);
          }
        } catch {
          res.end();
          clearInterval(timer);
        }
      };

      const timer = setInterval(send, 2000);
      void send();

      req.on("close", () => clearInterval(timer));
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Cost estimate endpoint (I2): after the assess stage has produced a manifest,
 * returns the expected number of lessons and a rough USD cost estimate so the
 * user can confirm before committing to generation.
 */
router.get(
  "/jobs/:id/cost-estimate",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = z.string().uuid().parse(req.params.id);
      const job = await jobService.get(req.userId as string, id);

      const progress =
        typeof job.stage_progress === "string"
          ? JSON.parse(job.stage_progress)
          : (job.stage_progress ?? {});

      const candidateCount: number = progress.lessonsTotal ?? progress.candidatesFound ?? 0;
      const completedCount: number = progress.lessonsGenerated ?? 0;
      const executionMode = job.execution_mode_resolved || resolveGenerationExecutionMode(job.execution_mode_requested || "auto", candidateCount);
      const model = job.provider_model || process.env.PRIMARY_AI_MODEL || "gemini-2.5-flash";
      const rows = await database("generation_attempts")
        .where({ generation_job_id: id, status: "succeeded" })
        .select("model", "request_type", "input_tokens", "output_tokens", "cached_tokens", "thinking_tokens", "latency_ms", "cost_usd");
      const attempts = rows.map((row: any) => ({
        model: String(row.model || model),
        requestType: String(row.request_type || "unknown"),
        inputTokens: Number(row.input_tokens || 0),
        outputTokens: Number(row.output_tokens || 0),
        cachedTokens: Number(row.cached_tokens || 0),
        thinkingTokens: Number(row.thinking_tokens || 0),
        latencyMs: Number(row.latency_ms || 0),
        costUsd: Number(row.cost_usd || 0),
      }));
      const actual = aggregateGeminiUsage(attempts);
      const projection = projectFromObservedAttempts(
        attempts.filter((item) => item.requestType.includes("lesson")),
        Math.max(0, candidateCount - completedCount),
        { inputTokens: 3_000, outputTokens: 2_000 },
        model,
        executionMode,
      );

      res.json({
        jobId: id,
        status: job.status,
        candidateCount,
        completedCount,
        executionMode,
        requestedExecutionMode: job.execution_mode_requested || "auto",
        model,
        actual,
        projection,
        projectedTotalCostUsd: Number((actual.costUsd + projection.estimatedCostUsd).toFixed(6)),
        batchTurnaroundNotice: executionMode === "batch" ? "Asynchronous processing may take up to 24 hours." : null,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
