import express, { Router, Response, NextFunction } from "express";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { database } from "../utils/db";
import { displayVocabularyLabel } from "../services/vocabulary-sense.service";

const router: Router = express.Router();

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Serialize queue introduction per learner. Insert only missing rows in SQL;
// never allocate an array containing every lesson or rewrite all progress rows.
export async function ensureFlashcards(userId: string) {
  await database.transaction(async (trx) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `flashcards:${userId}`,
    ]);
    await trx.raw(
      `INSERT INTO user_progress (user_id, word_id, category_id, status, next_review_at)
      SELECT ?, w.id, w.category_id, 'not_started', '9999-12-31T00:00:00Z'
      FROM vocabulary_words w WHERE (w.owner_user_id = ? OR w.owner_user_id IS NULL)
      AND NOT EXISTS (SELECT 1 FROM user_progress p WHERE p.user_id = ? AND p.word_id = w.id)
      ON CONFLICT (user_id, word_id) DO NOTHING`,
      [userId, userId, userId],
    );
    await trx.raw(
      `INSERT INTO flashcard_queue (user_id, word_id, progress_id, queue_position, due_at, card_type)
      SELECT p.user_id, p.word_id, p.id, 0, COALESCE(p.next_review_at, '9999-12-31T00:00:00Z'), 'vocabulary'
      FROM user_progress p JOIN vocabulary_words w ON w.id = p.word_id
      WHERE p.user_id = ? AND (w.owner_user_id = ? OR w.owner_user_id IS NULL)
      AND NOT EXISTS (SELECT 1 FROM flashcard_queue q WHERE q.user_id = p.user_id AND q.word_id = p.word_id)
      ON CONFLICT (user_id, word_id) DO NOTHING`,
      [userId, userId],
    );
    const profile = await trx("fluency_profiles")
      .where({ user_id: userId })
      .first();
    const timezone = profile?.timezone || "Europe/Warsaw";
    const limit = profile?.new_per_day ?? 10;
    const introduced = await trx("user_progress")
      .where({ user_id: userId })
      .whereRaw("date(timezone(?, introduced_at)) = date(timezone(?, now()))", [
        timezone,
        timezone,
      ])
      .count({ count: "*" })
      .first();
    const quota = Math.max(0, limit - Number(introduced?.count || 0));
    if (!quota) return;
    const rows = await trx("user_progress as p")
      .join("vocabulary_words as w", "w.id", "p.word_id")
      .where("p.user_id", userId)
      .whereNull("p.introduced_at")
      .where((q: any) =>
        q.where("w.owner_user_id", userId).orWhereNull("w.owner_user_id"),
      )
      .orderBy("p.created_at")
      .orderBy("p.id")
      .limit(quota)
      .select("p.word_id");
    if (!rows.length) return;
    const ids = rows.map((r: any) => r.word_id);
    const now = new Date();
    await trx("user_progress")
      .where({ user_id: userId })
      .whereIn("word_id", ids)
      .update({ introduced_at: now, next_review_at: now, updated_at: now });
    await trx("flashcard_queue")
      .where({ user_id: userId })
      .whereIn("word_id", ids)
      .update({ due_at: now, updated_at: now });
  });
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
          "vocabulary_words.sense_rank",
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
        .limit(
          z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .default(20)
            .parse(req.query.limit),
        );

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

      res.json({
        cards: cards.map((card: any) => ({
          ...card,
          display_label: displayVocabularyLabel(card.word, card.sense_rank),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

const ReviewSchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy"]),
  requestId: z.string().uuid().optional(),
});

router.post(
  "/:wordId/review",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rating, requestId } = ReviewSchema.parse(req.body);
      const wordId = z.string().uuid().parse(req.params.wordId);
      const result = await database.transaction(async (trx) => {
        await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
          `flashcards:${req.userId}`,
        ]);
        const visible = await trx("vocabulary_words")
          .where({ id: wordId })
          .where((q: any) =>
            q.where("owner_user_id", req.userId).orWhereNull("owner_user_id"),
          )
          .first();
        if (!visible)
          throw Object.assign(new Error("Entry not found"), { status: 404 });
        if (requestId) {
          const receipt = await trx("flashcard_review_receipts")
            .where({ user_id: req.userId, request_id: requestId })
            .first();
          if (receipt) {
            if (receipt.word_id !== wordId || receipt.rating !== rating)
              throw Object.assign(new Error("Review identity conflict"), {
                status: 409,
              });
            return receipt.result;
          }
        }
        const progress = await trx("user_progress")
          .where({ user_id: req.userId, word_id: req.params.wordId })
          .first();

        if (!progress) {
          throw Object.assign(new Error("Progress not found"), { status: 404 });
        }

        let ease = Number(progress.ease_factor || 2.5);
        let interval = Number(progress.interval || 1);
        let proficiency = Number(progress.proficiency_level || 0);
        let correct = Number(progress.times_correct || 0);
        let incorrect = Number(progress.times_incorrect || 0);
        let relearnMinutes: number | null = null;

        if (rating === "again") {
          ease = Math.max(1.3, ease - 0.25);
          interval = 1;
          proficiency = 0;
          incorrect += 1;
          // Standard SRS practice (Anki/SuperMemo): a missed card comes back
          // within the same session, not a full day later. Pushing it a full
          // day out means the learner never gets the corrective repetition
          // that actually fixes the miss.
          relearnMinutes = 10;
        } else {
          const modifier =
            rating === "hard" ? 0.8 : rating === "easy" ? 1.5 : 1;
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
        if (relearnMinutes !== null) {
          nextReviewAt.setMinutes(nextReviewAt.getMinutes() + relearnMinutes);
        } else {
          nextReviewAt.setDate(nextReviewAt.getDate() + interval);
        }

        const [updated] = await trx("user_progress")
          .where("id", progress.id)
          .update({
            status: "in_progress",
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

        await trx("flashcard_queue")
          .where({ user_id: req.userId, word_id: req.params.wordId })
          .update({
            due_at: nextReviewAt,
            updated_at: new Date(),
          });

        const result = { progress: updated };
        if (requestId)
          await trx("flashcard_review_receipts").insert({
            user_id: req.userId,
            request_id: requestId,
            word_id: wordId,
            rating,
            result,
          });
        return result;
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
