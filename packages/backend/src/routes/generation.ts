import express, { NextFunction, Response, Router } from "express";
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
const generationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.use(authMiddleware);
router.use(generationLimiter as unknown as express.RequestHandler);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const CreateJobSchema = z.object({
  sourceName: z.string().min(1).max(255),
  sourceType: z.enum(["text", "pdf", "srt", "docx", "epub"]),
  sourceContent: z.string().min(1),
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

export default router;
