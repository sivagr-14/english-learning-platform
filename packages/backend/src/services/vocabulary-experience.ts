import { z } from "zod";
import { database } from "../utils/db";

export const LearnerStateSchema = z.object({
  familiarity: z.enum(["unassessed", "learning", "known"]).optional(),
  note: z.string().max(6000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide a note or familiarity");

export const VocabularyPreferencesSchema = z.object({
  accent: z.enum(["en-GB", "en-US"]),
  show_tamil: z.boolean(),
  theme: z.enum(["light", "dark"]),
}).strict();

// Personal familiarity is deliberately independent of review proficiency.
export async function saveLearnerState(userId: string, wordId: string, input: z.infer<typeof LearnerStateSchema>) {
  return database.transaction(async (trx) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [`flashcards:${userId}`]);
    const word = await trx("vocabulary_words").where({ id: wordId }).where((q: any) =>
      q.where("owner_user_id", userId).orWhereNull("owner_user_id"),
    ).first();
    if (!word) return null;
    const now = new Date();
    const [state] = await trx("vocabulary_learner_state")
      .insert({ user_id: userId, word_id: wordId, ...input })
      .onConflict(["user_id", "word_id"]).merge({ ...input, updated_at: now }).returning("*");
    if (input.familiarity === "learning") {
      await trx("user_progress").insert({
        user_id: userId, word_id: wordId, category_id: word.category_id,
        status: "in_progress", introduced_at: now, next_review_at: now,
      }).onConflict(["user_id", "word_id"]).ignore();
      const progress = await trx("user_progress").where({ user_id: userId, word_id: wordId }).first();
      if (Number(progress.times_reviewed || 0) === 0 && Number(progress.proficiency_level || 0) < 4) {
        await trx("user_progress").where({ id: progress.id }).update({
          status: "in_progress", introduced_at: progress.introduced_at || now,
          next_review_at: now, updated_at: now,
        });
        await trx("flashcard_queue").insert({
          user_id: userId, word_id: wordId, progress_id: progress.id,
          queue_position: 0, due_at: now, card_type: "vocabulary",
        }).onConflict(["user_id", "word_id"]).merge({ due_at: now, updated_at: now });
      }
    }
    // Marking a word known never claims a correct answer or changes past reviews.
    if (input.familiarity === "known") {
      const progress = await trx("user_progress").where({ user_id: userId, word_id: wordId }).first();
      if (progress && Number(progress.times_reviewed || 0) === 0) {
        const later = new Date("9999-12-31T00:00:00Z");
        await trx("user_progress").where({ id: progress.id }).update({ next_review_at: later });
        await trx("flashcard_queue").where({ user_id: userId, word_id: wordId }).update({ due_at: later });
      }
    }
    return state;
  });
}
