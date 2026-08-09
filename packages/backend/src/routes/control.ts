import express, { NextFunction, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { AssessmentControlService } from "../services/assessment-control.service";
import {
  ContentPackService,
  synchronizeContentPacks,
} from "../services/content-pack.service";
import { database } from "../utils/db";

const router: Router = express.Router();
const service = new AssessmentControlService(database);
const contentPacks = new ContentPackService(database);
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
  "/connection-status",
  (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      mode: "chatgpt-github-content-inbox",
      apiKeyRequired: false,
      inboxBranch: "chatgpt-content-inbox",
    });
  },
);

router.get(
  "/content-packs",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [manifests, ingestErrors] = await Promise.all([
        contentPacks.listManifests(req.userId!),
        contentPacks.listIngestErrors(),
      ]);
      res.json({ manifests, ingestErrors });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/content-packs/sync",
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await synchronizeContentPacks(database);
      res.json({
        message: "Local ChatGPT content packs synchronized.",
        result,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/content-packs/process",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await contentPacks.processAvailableManifests(req.userId!));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/content-packs/:id",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const manifestId = z.string().trim().min(3).max(120).parse(req.params.id);
      res.json({
        manifest: await contentPacks.getManifest(req.userId!, manifestId),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/content-packs/:id/claim",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const manifestId = z.string().trim().min(3).max(120).parse(req.params.id);
      const manifest = await contentPacks.claimManifest(
        req.userId!,
        manifestId,
      );
      res.json({
        message:
          "Manifest claimed. All policy-eligible candidates were scheduled automatically.",
        manifest,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/content-packs/:id/approve",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const manifestId = z.string().trim().min(3).max(120).parse(req.params.id);
      const input = z
        .object({
          candidateIds: z
            .array(z.string().trim().min(3).max(140))
            .min(1)
            .optional(),
        })
        .default({})
        .parse(req.body);
      const manifest = await contentPacks.approveManifest(
        req.userId!,
        manifestId,
        input.candidateIds,
      );
      res.json({
        message:
          "Approved candidates are saved automatically as validated ChatGPT batches arrive.",
        manifest,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/content-packs/:id/verify",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const manifestId = z.string().trim().min(3).max(120).parse(req.params.id);
      res.json(await contentPacks.verifyManifest(req.userId!, manifestId));
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
      res.status(202).json({
        message: "Approved candidates are ready for ChatGPT content batches.",
        generationJob,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
