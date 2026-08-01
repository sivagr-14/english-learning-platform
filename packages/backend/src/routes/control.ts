import express, { NextFunction, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { AssessmentControlService } from "../services/assessment-control.service";
import { AutomatedVocabularyService } from "../services/openai-generation.service";
import { database } from "../utils/db";

const router: Router = express.Router();
const service = new AssessmentControlService(database);
const automation = new AutomatedVocabularyService(database);
const controlRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

router.use(authMiddleware);
router.use(controlRateLimiter as unknown as express.RequestHandler);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get(
  "/automation-status",
  async (_req: AuthenticatedRequest, res: Response) => {
    res.json(automation.status());
  },
);

router.post(
  "/assess-text",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = z
        .object({
          name: z.string().trim().min(1).max(255),
          text: z.string().trim().min(20).max(150_000),
        })
        .parse(req.body);
      const assessment = await automation.assessText(
        req.userId!,
        input.name,
        input.text,
      );
      res.status(201).json({
        message: "Assessment saved. Review the exact counts before approval.",
        assessment,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/overview",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const overview = await service.getOverview(req.userId!);
      res.json(overview);
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/assessments",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const assessment = await service.createAssessment(req.userId!, req.body);
      res.status(201).json({
        message:
          "Assessment saved. No vocabulary entries were created or updated.",
        assessment,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/assessments/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const assessmentId = z.string().uuid().parse(req.params.id);
      const assessment = await service.getAssessment(req.userId!, assessmentId);
      res.json({ assessment });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/assessments/:id/approve",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const assessmentId = z.string().uuid().parse(req.params.id);
      const input = z
        .object({
          candidateIds: z.array(z.string().uuid()).min(1).optional(),
        })
        .default({})
        .parse(req.body);
      const generationJob = await service.approveAssessment(
        req.userId!,
        assessmentId,
        input.candidateIds,
      );
      void automation
        .processJob(req.userId!, generationJob.id)
        .catch((error) => console.error("Generation job failed", error));
      res.status(202).json({
        message:
          "Approved candidates queued for ChatGPT-controlled generation.",
        generationJob,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

export { automation as automatedVocabularyService };
