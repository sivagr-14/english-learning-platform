import express, { NextFunction, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { AssessmentControlService } from "../services/assessment-control.service";
import { database } from "../utils/db";

const router: Router = express.Router();
const service = new AssessmentControlService(database);
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
