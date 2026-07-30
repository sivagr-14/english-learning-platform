import express, { NextFunction, Response, Router } from "express";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { database } from "../utils/db";

const router: Router = express.Router();

router.use(authMiddleware);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.get(
  "/",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const visibleWords = database("vocabulary_words")
        .where((builder) =>
          builder.where("owner_user_id", userId).orWhereNull("owner_user_id"),
        )
        .select("id");

      const [entryResult, progressResult, dueResult, categories] =
        await Promise.all([
          database("vocabulary_words")
            .where((builder) =>
              builder
                .where("owner_user_id", userId)
                .orWhereNull("owner_user_id"),
            )
            .countDistinct({ total_entries: "id" })
            .first(),
          database("user_progress")
            .where("user_id", userId)
            .whereIn("word_id", visibleWords.clone())
            .select(
              database.raw(
                "COUNT(*) FILTER (WHERE status = 'in_progress') AS learning",
              ),
              database.raw(
                "COUNT(*) FILTER (WHERE status = 'mastered') AS mastered",
              ),
              database.raw("COALESCE(SUM(times_reviewed), 0) AS reviews"),
              database.raw("COALESCE(SUM(times_correct), 0) AS correct"),
              database.raw("COALESCE(SUM(times_incorrect), 0) AS incorrect"),
            )
            .first(),
          database("flashcard_queue")
            .where("user_id", userId)
            .whereIn("word_id", visibleWords.clone())
            .where("due_at", "<=", new Date())
            .count({ due_now: "id" })
            .first(),
          database("vocabulary_categories")
            .leftJoin(
              "vocabulary_words",
              "vocabulary_categories.id",
              "vocabulary_words.category_id",
            )
            .leftJoin("user_progress", (join) => {
              join
                .on("user_progress.word_id", "=", "vocabulary_words.id")
                .andOn(
                  "user_progress.user_id",
                  "=",
                  database.raw("?", [userId]),
                );
            })
            .where((builder) =>
              builder
                .where("vocabulary_words.owner_user_id", userId)
                .orWhereNull("vocabulary_words.owner_user_id"),
            )
            .groupBy(
              "vocabulary_categories.id",
              "vocabulary_categories.track_number",
              "vocabulary_categories.category_number",
            )
            .select(
              "vocabulary_categories.id",
              "vocabulary_categories.track_name",
              "vocabulary_categories.category_name",
              "vocabulary_categories.color_code",
            )
            .countDistinct({ total: "vocabulary_words.id" })
            .select(
              database.raw(
                "COUNT(DISTINCT user_progress.word_id) FILTER (WHERE user_progress.status = 'mastered') AS mastered",
              ),
            )
            .havingRaw("COUNT(DISTINCT vocabulary_words.id) > 0")
            .orderBy([
              { column: "vocabulary_categories.track_number" },
              { column: "vocabulary_categories.category_number" },
            ]),
        ]);

      const correct = Number(progressResult?.correct || 0);
      const incorrect = Number(progressResult?.incorrect || 0);
      const attempts = correct + incorrect;

      res.json({
        summary: {
          totalEntries: Number(entryResult?.total_entries || 0),
          learning: Number(progressResult?.learning || 0),
          mastered: Number(progressResult?.mastered || 0),
          dueNow: Number(dueResult?.due_now || 0),
          reviews: Number(progressResult?.reviews || 0),
          accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
        },
        categories: categories.map((category: any) => ({
          ...category,
          total: Number(category.total || 0),
          mastered: Number(category.mastered || 0),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
