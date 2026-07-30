import { STARTER_SAMPLES, STARTER_SAMPLE_KEYS } from "../data/starter-samples";
import { database } from "../utils/db";

export async function starterSampleStatus(userId: string) {
  const [{ count }] = await database("vocabulary_words")
    .where({ owner_user_id: userId, is_starter_sample: true })
    .count({ count: "id" });

  return {
    available: STARTER_SAMPLES.length,
    loaded: Number(count || 0),
  };
}

export async function loadStarterSamples(userId: string) {
  return database.transaction(async (trx) => {
    const categories = await trx("vocabulary_categories")
      .whereIn(
        "category_name",
        STARTER_SAMPLES.map((sample) => sample.categoryName),
      )
      .select("id", "category_name");

    const categoryIds = new Map(
      categories.map((category) => [category.category_name, category.id]),
    );
    const missingCategories = STARTER_SAMPLES.filter(
      (sample) => !categoryIds.has(sample.categoryName),
    ).map((sample) => sample.categoryName);

    if (missingCategories.length) {
      throw new Error(
        `Starter sample categories are missing: ${missingCategories.join(", ")}`,
      );
    }

    let created = 0;
    let existing = 0;

    for (const sample of STARTER_SAMPLES) {
      const current = await trx("vocabulary_words")
        .where({
          owner_user_id: userId,
          canonical_key: sample.canonicalKey,
        })
        .first();

      if (current) {
        existing += 1;
        continue;
      }

      const categoryId = categoryIds.get(sample.categoryName);
      const [word] = await trx("vocabulary_words")
        .insert({
          owner_user_id: userId,
          category_id: categoryId,
          word: sample.word,
          pronunciation: sample.pronunciation,
          word_type: sample.wordType,
          cefr_level: sample.cefrLevel,
          frequency: sample.frequency,
          english_meaning: sample.englishMeaning,
          tamil_meaning: sample.tamilMeaning,
          core_idea: sample.coreIdea,
          canonical_key: sample.canonicalKey,
          base_form: sample.word,
          item_type: sample.itemType,
          fluency_value: "High",
          learning_priority: "Starter",
          entry_version: 1,
          is_starter_sample: true,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*");

      await trx("vocabulary_lessons").insert({
        word_id: word.id,
        lesson_data: JSON.stringify(sample.lesson),
        created_at: new Date(),
        updated_at: new Date(),
      });

      await trx("vocabulary_entry_categories").insert({
        word_id: word.id,
        category_id: categoryId,
        relationship: "primary",
        sort_order: 0,
        created_at: new Date(),
      });

      await trx("vocabulary_entry_versions").insert({
        word_id: word.id,
        changed_by_user_id: userId,
        version_number: 1,
        change_type: "create",
        snapshot: JSON.stringify({
          word: sample.word,
          category: sample.categoryName,
          cefrLevel: sample.cefrLevel,
          itemType: sample.itemType,
          lesson: sample.lesson,
          starterSample: true,
        }),
        change_reason: "Built-in starter sample",
        created_at: new Date(),
      });

      const [progress] = await trx("user_progress")
        .insert({
          user_id: userId,
          word_id: word.id,
          category_id: categoryId,
          status: "not_started",
          proficiency_level: 0,
          times_reviewed: 0,
          next_review_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning("*");

      await trx("flashcard_queue").insert({
        user_id: userId,
        word_id: word.id,
        progress_id: progress.id,
        queue_position: 0,
        due_at: new Date(),
        card_type: "vocabulary",
        created_at: new Date(),
        updated_at: new Date(),
      });

      created += 1;
    }

    return {
      available: STARTER_SAMPLES.length,
      loaded: created + existing,
      created,
      existing,
    };
  });
}

export async function removeStarterSamples(userId: string) {
  return database.transaction(async (trx) => {
    const removed = await trx("vocabulary_words")
      .where({ owner_user_id: userId, is_starter_sample: true })
      .whereIn("canonical_key", STARTER_SAMPLE_KEYS)
      .delete();

    return { removed: Number(removed || 0) };
  });
}
