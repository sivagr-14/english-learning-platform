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
  sourceType: z.enum(["text", "pdf", "srt", "docx", "epub"]),
  // ~500 KB of plain text ≈ a 350-page book. Larger uploads should use
  // a multipart file endpoint (Phase 4) rather than a JSON string field.
  sourceContent: z.string().min(1).max(500_000),
});

router.post(
  "/jobs",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
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
          sourceContent: input.sourceContent,
        });
      }

      res.status(isNew ? 201 : 200).json({ job, alreadyExisted: !isNew });
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

      const progress = typeof job.stage_progress === "string"
        ? JSON.parse(job.stage_progress)
        : (job.stage_progress ?? {});

      const candidateCount: number = progress.candidatesFound ?? 0;
      // Rough estimate: ~3,000 tokens input + 2,000 tokens output per lesson
      // at Gemini Flash rates ($0.30/$2.50 per 1M tokens).
      const estimatedInputTokens = candidateCount * 3_000;
      const estimatedOutputTokens = candidateCount * 2_000;
      const estimatedCostUsd =
        (estimatedInputTokens * 0.30 + estimatedOutputTokens * 2.50) / 1_000_000;

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
