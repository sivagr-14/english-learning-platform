import express, { Router, Response, NextFunction } from "express";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { database } from "../utils/db";

const router: Router = express.Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

async function ensureFlashcards(userId: string) {
  const words = await database("vocabulary_words")
    .where((builder) =>
      builder.where("owner_user_id", userId).orWhereNull("owner_user_id"),
    )
    .select("id", "category_id");

  for (const word of words) {
    const [progress] = await database("user_progress")
      .insert({
        user_id: userId,
        word_id: word.id,
        category_id: word.category_id,
        status: "not_started",
        proficiency_level: 0,
        times_reviewed: 0,
        next_review_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(["user_id", "word_id"])
      .merge({
        category_id: word.category_id,
        updated_at: new Date(),
      })
      .returning("*");

    await database("flashcard_queue")
      .insert({
        user_id: userId,
        word_id: word.id,
        progress_id: progress.id,
        queue_position: 0,
        due_at: progress.next_review_at || new Date(),
        card_type: "vocabulary",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(["user_id", "word_id"])
      .merge({
        progress_id: progress.id,
        due_at: progress.next_review_at || new Date(),
        updated_at: new Date(),
      });
  }
}

router.get(
  "/categories",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await ensureFlashcards(req.userId as string);

      const categories = await database("flashcard_queue")
        .join(
          "vocabulary_words",
          "flashcard_queue.word_id",
          "vocabulary_words.id",
        )
        .join(
          "vocabulary_entry_categories",
          "vocabulary_words.id",
          "vocabulary_entry_categories.word_id",
        )
        .join(
          "vocabulary_categories",
          "vocabulary_entry_categories.category_id",
          "vocabulary_categories.id",
        )
        .select(
          "vocabulary_categories.id",
          "vocabulary_categories.track_name",
          "vocabulary_categories.category_name",
          "vocabulary_categories.difficulty_level",
          "vocabulary_categories.color_code",
        )
        .countDistinct({ due_count: "flashcard_queue.id" })
        .where("flashcard_queue.user_id", req.userId)
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .where((builder) =>
          builder
            .where("vocabulary_categories.owner_user_id", req.userId)
            .orWhereNull("vocabulary_categories.owner_user_id"),
        )
        .where("flashcard_queue.due_at", "<=", new Date())
        .groupBy("vocabulary_categories.id")
        .orderBy([
          { column: "vocabulary_categories.track_number" },
          { column: "vocabulary_categories.category_number" },
        ]);

      res.json({ categories });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/due",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await ensureFlashcards(req.userId as string);
      const categoryId = z
        .string()
        .uuid()
        .optional()
        .parse(req.query.categoryId);

      const query = database("flashcard_queue")
        .join(
          "vocabulary_words",
          "flashcard_queue.word_id",
          "vocabulary_words.id",
        )
        .join(
          "vocabulary_categories",
          "vocabulary_words.category_id",
          "vocabulary_categories.id",
        )
        .join(
          "user_progress",
          "flashcard_queue.progress_id",
          "user_progress.id",
        )
        .leftJoin(
          "vocabulary_lessons",
          "vocabulary_words.id",
          "vocabulary_lessons.word_id",
        )
        .select(
          "flashcard_queue.id as queue_id",
          "flashcard_queue.due_at",
          "vocabulary_words.id",
          "vocabulary_words.word",
          "vocabulary_words.pronunciation",
          "vocabulary_words.word_type",
          "vocabulary_words.cefr_level",
          "vocabulary_words.frequency",
          "vocabulary_words.english_meaning",
          "vocabulary_words.tamil_meaning",
          "vocabulary_words.core_idea",
          "vocabulary_categories.track_name",
          "vocabulary_categories.category_name",
          "user_progress.proficiency_level",
          "user_progress.times_reviewed",
          "user_progress.ease_factor",
          "user_progress.interval",
          "user_progress.next_review_at",
          "vocabulary_lessons.lesson_data",
        )
        .where("flashcard_queue.user_id", req.userId)
        .where((builder) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .where("flashcard_queue.due_at", "<=", new Date())
        .orderBy("flashcard_queue.due_at")
        .limit(Number(req.query.limit || 20));

      if (categoryId) {
        const category = await database("vocabulary_categories")
          .where({ id: categoryId, is_active: true })
          .where((builder) =>
            builder
              .where("owner_user_id", req.userId)
              .orWhereNull("owner_user_id"),
          )
          .first();
        if (!category) {
          return res.status(404).json({ message: "Category not found" });
        }

        query.whereExists((linked) => {
          linked
            .select(database.raw("1"))
            .from("vocabulary_entry_categories")
            .whereRaw(
              "vocabulary_entry_categories.word_id = vocabulary_words.id",
            )
            .where("vocabulary_entry_categories.category_id", categoryId);
        });
      }

      const cards = await query;

      res.json({ cards });
    } catch (error) {
      next(error);
    }
  },
);

const ReviewSchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
});

router.post(
  "/:wordId/review",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rating } = ReviewSchema.parse(req.body);
      const progress = await database("user_progress")
        .where({ user_id: req.userId, word_id: req.params.wordId })
        .first();

      if (!progress) {
        return res.status(404).json({ message: "Progress not found" });
      }

      let ease = Number(progress.ease_factor || 2.5);
      let interval = Number(progress.interval || 1);
      let proficiency = Number(progress.proficiency_level || 0);
      let correct = Number(progress.times_correct || 0);
      let incorrect = Number(progress.times_incorrect || 0);

      if (rating === "again") {
        ease = Math.max(1.3, ease - 0.25);
        interval = 1;
        proficiency = 0;
        incorrect += 1;
      } else {
        const modifier = rating === "hard" ? 0.8 : rating === "easy" ? 1.5 : 1;
        ease = Math.max(
          1.3,
          ease + (rating === "easy" ? 0.15 : rating === "hard" ? -0.1 : 0.05),
        );
        interval =
          progress.times_reviewed === 0
            ? rating === "hard"
              ? 1
              : rating === "easy"
                ? 4
                : 2
            : Math.max(1, Math.round(interval * ease * modifier));
        proficiency = Math.min(5, proficiency + (rating === "easy" ? 2 : 1));
        correct += 1;
      }

      const nextReviewAt = new Date();
      nextReviewAt.setDate(nextReviewAt.getDate() + interval);

      const [updated] = await database("user_progress")
        .where("id", progress.id)
        .update({
          status: proficiency >= 4 ? "mastered" : "in_progress",
          proficiency_level: proficiency,
          times_reviewed: Number(progress.times_reviewed || 0) + 1,
          times_correct: correct,
          times_incorrect: incorrect,
          last_reviewed_at: new Date(),
          next_review_at: nextReviewAt,
          ease_factor: ease,
          interval,
          updated_at: new Date(),
        })
        .returning("*");

      await database("flashcard_queue")
        .where({ user_id: req.userId, word_id: req.params.wordId })
        .update({
          due_at: nextReviewAt,
          updated_at: new Date(),
        });

      res.json({ progress: updated });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
