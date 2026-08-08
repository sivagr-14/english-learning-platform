import express, { NextFunction, Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { GenerationJobService } from "../services/generation-job.service";
import { enqueueExtraction } from "../queue/generation.queue";
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

const router: Router = express.Router();
const jobService = new GenerationJobService(database);

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
    primaryConfigured: primaryKeySet,
    escalationConfigured: escalationKeySet,
    primaryProvider: process.env.PRIMARY_AI_PROVIDER || "gemini",
    primaryModel: process.env.PRIMARY_AI_MODEL || "gemini-2.0-flash",
    escalationProvider: process.env.ESCALATION_AI_PROVIDER || "gemini",
    escalationModel: process.env.ESCALATION_AI_MODEL || "gemini-2.5-pro",
  });
});

router.use(authMiddleware);
router.use(generationLimiter as unknown as express.RequestHandler);

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
});

router.post(
  "/jobs",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
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

      const candidateCount: number = progress.candidatesFound ?? 0;
      // Rough estimate: ~3,000 tokens input + 2,000 tokens output per lesson
      // at Gemini Flash rates ($0.30/$2.50 per 1M tokens).
      const estimatedInputTokens = candidateCount * 3_000;
      const estimatedOutputTokens = candidateCount * 2_000;
      const estimatedCostUsd =
        (estimatedInputTokens * 0.3 + estimatedOutputTokens * 2.5) / 1_000_000;

      res.json({
        jobId: id,
        status: job.status,
        candidateCount,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
        model: process.env.PRIMARY_AI_MODEL || "gemini-2.0-flash",
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
