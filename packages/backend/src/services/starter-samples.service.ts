import {
  STARTER_SAMPLES,
  STARTER_SAMPLE_KEYS,
  STARTER_SAMPLE_VERSION,
  StarterSample,
} from "../data/starter-samples";
import { database } from "../utils/db";

function sampleSnapshot(sample: StarterSample) {
  return {
    word: sample.word,
    category: sample.categoryName,
    cefrLevel: sample.cefrLevel,
    itemType: sample.itemType,
    lesson: sample.lesson,
    starterSample: true,
  };
}

function lessonVersion(value: unknown) {
  if (!value) return 0;

  const lesson =
    typeof value === "string"
      ? (JSON.parse(value) as Record<string, unknown>)
      : (value as Record<string, unknown>);

  return Number(lesson.sample_version || 0);
}

export async function starterSampleStatus(userId: string) {
  const samples = await database("vocabulary_words")
    .leftJoin(
      "vocabulary_lessons",
      "vocabulary_words.id",
      "vocabulary_lessons.word_id",
    )
    .where({ owner_user_id: userId, is_starter_sample: true })
    .whereIn("canonical_key", STARTER_SAMPLE_KEYS)
    .select("vocabulary_lessons.lesson_data");

  return {
    available: STARTER_SAMPLES.length,
    loaded: samples.length,
    outdated: samples.filter(
      (sample) => lessonVersion(sample.lesson_data) < STARTER_SAMPLE_VERSION,
    ).length,
    version: STARTER_SAMPLE_VERSION,
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
    let updated = 0;
    let existing = 0;
    let conflicts = 0;

    for (const sample of STARTER_SAMPLES) {
      const current = await trx("vocabulary_words")
        .leftJoin(
          "vocabulary_lessons",
          "vocabulary_words.id",
          "vocabulary_lessons.word_id",
        )
        .select(
          "vocabulary_words.*",
          "vocabulary_lessons.lesson_data",
          "vocabulary_lessons.id as lesson_id",
        )
        .where({
          owner_user_id: userId,
          canonical_key: sample.canonicalKey,
        })
        .first();

      if (current) {
        if (!current.is_starter_sample) {
          conflicts += 1;
          continue;
        }

        if (lessonVersion(current.lesson_data) >= STARTER_SAMPLE_VERSION) {
          existing += 1;
          continue;
        }

        const categoryId = categoryIds.get(sample.categoryName);
        const nextVersion = Number(current.entry_version || 1) + 1;

        await trx("vocabulary_words").where({ id: current.id }).update({
          category_id: categoryId,
          word: sample.word,
          pronunciation: sample.pronunciation,
          word_type: sample.wordType,
          cefr_level: sample.cefrLevel,
          frequency: sample.frequency,
          english_meaning: sample.englishMeaning,
          tamil_meaning: sample.tamilMeaning,
          core_idea: sample.coreIdea,
          base_form: sample.word,
          item_type: sample.itemType,
          entry_version: nextVersion,
          updated_at: new Date(),
        });

        if (current.lesson_id) {
          await trx("vocabulary_lessons")
            .where({ id: current.lesson_id })
            .update({
              lesson_data: JSON.stringify(sample.lesson),
              updated_at: new Date(),
            });
        } else {
          await trx("vocabulary_lessons").insert({
            word_id: current.id,
            lesson_data: JSON.stringify(sample.lesson),
            created_at: new Date(),
            updated_at: new Date(),
          });
        }

        await trx("vocabulary_entry_categories")
          .where({ word_id: current.id, relationship: "primary" })
          .update({ category_id: categoryId });

        await trx("user_progress")
          .where({ user_id: userId, word_id: current.id })
          .update({ category_id: categoryId, updated_at: new Date() });

        await trx("vocabulary_entry_versions").insert({
          word_id: current.id,
          changed_by_user_id: userId,
          version_number: nextVersion,
          change_type: "update",
          snapshot: JSON.stringify(sampleSnapshot(sample)),
          change_reason: `Refresh built-in starter sample to version ${STARTER_SAMPLE_VERSION}`,
          created_at: new Date(),
        });

        updated += 1;
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
        snapshot: JSON.stringify(sampleSnapshot(sample)),
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

    const [{ count }] = await trx("vocabulary_words")
      .where({ owner_user_id: userId, is_starter_sample: true })
      .whereIn("canonical_key", STARTER_SAMPLE_KEYS)
      .count({ count: "id" });

    return {
      available: STARTER_SAMPLES.length,
      loaded: Number(count || 0),
      created,
      updated,
      existing,
      conflicts,
      version: STARTER_SAMPLE_VERSION,
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
