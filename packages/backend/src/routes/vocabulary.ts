import express, { Router, Response, NextFunction } from "express";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { database } from "../utils/db";
import {
  loadStarterSamples,
  removeStarterSamples,
  starterSampleStatus,
} from "../services/starter-samples.service";

const router: Router = express.Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await database("vocabulary_categories")
        .leftJoin(
          "vocabulary_words",
          "vocabulary_categories.id",
          "vocabulary_words.category_id",
        )
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .select(
          "vocabulary_categories.id",
          "vocabulary_categories.track_number",
          "vocabulary_categories.track_name",
          "vocabulary_categories.category_number",
          "vocabulary_categories.category_name",
          "vocabulary_categories.description",
          "vocabulary_categories.difficulty_level",
          "vocabulary_categories.estimated_words_count",
          "vocabulary_categories.color_code",
        )
        .count({ word_count: "vocabulary_words.id" })
        .groupBy("vocabulary_categories.id")
        .orderBy([{ column: "track_number" }, { column: "category_number" }]);

      res.json({ categories });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/categories",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await database("vocabulary_categories")
        .leftJoin(
          "vocabulary_words",
          "vocabulary_categories.id",
          "vocabulary_words.category_id",
        )
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .select(
          "vocabulary_categories.id",
          "vocabulary_categories.track_number",
          "vocabulary_categories.track_name",
          "vocabulary_categories.category_number",
          "vocabulary_categories.category_name",
          "vocabulary_categories.description",
          "vocabulary_categories.difficulty_level",
          "vocabulary_categories.estimated_words_count",
          "vocabulary_categories.color_code",
        )
        .count({ word_count: "vocabulary_words.id" })
        .groupBy("vocabulary_categories.id")
        .orderBy([{ column: "track_number" }, { column: "category_number" }]);

      res.json({ categories });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/categories/:id/words",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const words = await database("vocabulary_words")
        .leftJoin(
          "vocabulary_lessons",
          "vocabulary_words.id",
          "vocabulary_lessons.word_id",
        )
        .select(
          "vocabulary_words.id",
          "vocabulary_words.category_id",
          "vocabulary_words.word",
          "vocabulary_words.pronunciation",
          "vocabulary_words.word_type",
          "vocabulary_words.cefr_level",
          "vocabulary_words.frequency",
          "vocabulary_words.english_meaning",
          "vocabulary_words.tamil_meaning",
          "vocabulary_words.core_idea",
          "vocabulary_words.is_starter_sample",
          "vocabulary_lessons.lesson_data",
        )
        .where("vocabulary_words.category_id", req.params.id)
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .orderBy("vocabulary_words.word");

      res.json({ words });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/import/single",
  authMiddleware,
  async (_req: AuthenticatedRequest, res: Response) => {
    res.status(409).json({
      message:
        "Direct vocabulary creation is disabled. Assess the content in ChatGPT, review the exact counts, and approve it before entries are created.",
    });
  },
);

router.post(
  "/import/json",
  authMiddleware,
  async (_req: AuthenticatedRequest, res: Response) => {
    res.status(409).json({
      message:
        "Direct JSON import is disabled. Content must pass through ChatGPT assessment and approval first.",
    });
  },
);

router.get(
  "/starter-samples",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await starterSampleStatus(req.userId as string));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/starter-samples",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await loadStarterSamples(req.userId as string);
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/starter-samples",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await removeStarterSamples(req.userId as string));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/search",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = z
        .object({
          q: z.string().trim().min(1),
          limit: z.coerce.number().int().min(1).max(50).optional(),
        })
        .parse(req.query);
      const term = `%${input.q}%`;

      const words = await database("vocabulary_words")
        .join(
          "vocabulary_categories",
          "vocabulary_words.category_id",
          "vocabulary_categories.id",
        )
        .select(
          "vocabulary_words.id",
          "vocabulary_words.word",
          "vocabulary_words.word_type",
          "vocabulary_words.cefr_level",
          "vocabulary_words.frequency",
          "vocabulary_words.english_meaning",
          "vocabulary_words.tamil_meaning",
          "vocabulary_words.core_idea",
          "vocabulary_words.is_starter_sample",
          "vocabulary_categories.track_name",
          "vocabulary_categories.category_name",
        )
        .where((builder) => {
          builder
            .whereILike("vocabulary_words.word", term)
            .orWhereILike("vocabulary_words.english_meaning", term)
            .orWhereILike("vocabulary_words.tamil_meaning", term)
            .orWhereILike("vocabulary_words.core_idea", term)
            .orWhereILike("vocabulary_categories.category_name", term)
            .orWhereILike("vocabulary_categories.track_name", term);
        })
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .orderByRaw(
          `CASE WHEN vocabulary_words.word ILIKE ? THEN 0 ELSE 1 END`,
          [input.q],
        )
        .orderBy("vocabulary_words.word")
        .limit(input.limit || 20);

      res.json({ words });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/words/:id",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const word = await database("vocabulary_words")
        .join(
          "vocabulary_categories",
          "vocabulary_words.category_id",
          "vocabulary_categories.id",
        )
        .leftJoin(
          "vocabulary_lessons",
          "vocabulary_words.id",
          "vocabulary_lessons.word_id",
        )
        .select(
          "vocabulary_words.id",
          "vocabulary_words.category_id",
          "vocabulary_words.word",
          "vocabulary_words.pronunciation",
          "vocabulary_words.word_type",
          "vocabulary_words.cefr_level",
          "vocabulary_words.frequency",
          "vocabulary_words.english_meaning",
          "vocabulary_words.tamil_meaning",
          "vocabulary_words.core_idea",
          "vocabulary_words.is_starter_sample",
          "vocabulary_categories.track_name",
          "vocabulary_categories.category_name",
          "vocabulary_categories.description as category_description",
          "vocabulary_lessons.lesson_data",
        )
        .where("vocabulary_words.id", req.params.id)
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .first();

      if (!word) {
        return res.status(404).json({ message: "Word not found" });
      }

      res.json({ word });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/words/:id/lesson",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const lesson = await database("vocabulary_lessons")
        .join(
          "vocabulary_words",
          "vocabulary_lessons.word_id",
          "vocabulary_words.id",
        )
        .where("word_id", req.params.id)
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .select("vocabulary_lessons.*")
        .first();

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      res.json({ lesson: lesson.lesson_data || lesson });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
