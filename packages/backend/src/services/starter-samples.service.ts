import {
  STARTER_SAMPLES,
  STARTER_SAMPLE_KEYS,
  STARTER_SAMPLE_VERSION,
  StarterSample,
} from "../data/starter-samples";
import {
  assertVocabularyLessonCompliant,
  vocabularyLessonQualityIssues,
} from "../data/vocabulary-lesson-template";
import { database } from "../utils/db";
import {
  allocatePersistentSenseRank,
  lockVocabularyTerm,
  normalizeSenseKey,
  normalizeVocabularyTerm,
} from "./vocabulary-sense.service";
import { legacyTaxonomyPath } from "../data/vocabulary-taxonomy";

function starterSenseKey(sample: StarterSample) {
  return normalizeSenseKey(`starter ${sample.englishMeaning}`);
}

function sampleSnapshot(sample: StarterSample) {
  const taxonomy = legacyTaxonomyPath(sample.categoryName);
  return {
    word: sample.word,
    category: sample.categoryName,
    cefrLevel: sample.cefrLevel,
    itemType: sample.itemType,
    lesson: sample.lesson,
    starterSample: true,
    taxonomy,
  };
}

function readLesson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  try {
    return typeof value === "string"
      ? (JSON.parse(value) as Record<string, unknown>)
      : (value as Record<string, unknown>);
  } catch {
    return {};
  }
}

function lessonVersion(value: unknown) {
  const lesson = readLesson(value);
  return Number(lesson.sample_version || 0);
}

function lessonNeedsRefresh(value: unknown, sample: StarterSample) {
  return (
    lessonVersion(value) < STARTER_SAMPLE_VERSION ||
    vocabularyLessonQualityIssues(readLesson(value), sample.word).length > 0
  );
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
    .select("vocabulary_words.canonical_key", "vocabulary_lessons.lesson_data");

  return {
    available: STARTER_SAMPLES.length,
    loaded: samples.length,
    outdated: samples.filter((savedSample) => {
      const source = STARTER_SAMPLES.find(
        (sample) => sample.canonicalKey === savedSample.canonical_key,
      );
      return !source || lessonNeedsRefresh(savedSample.lesson_data, source);
    }).length,
    version: STARTER_SAMPLE_VERSION,
  };
}

export async function loadStarterSamples(userId: string) {
  return database.transaction(async (trx) => {
    await trx("starter_sample_preferences")
      .insert({
        user_id: userId,
        enabled: true,
        content_version: 0,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict("user_id")
      .merge({ enabled: true, updated_at: new Date() });
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
      assertVocabularyLessonCompliant(sample.lesson, sample.word);
      const normalizedTerm = normalizeVocabularyTerm(sample.word);
      const taxonomy = legacyTaxonomyPath(sample.categoryName);
      await lockVocabularyTerm(trx, userId, normalizedTerm);

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

        if (!lessonNeedsRefresh(current.lesson_data, sample)) {
          existing += 1;
          continue;
        }

        const categoryId = categoryIds.get(sample.categoryName);
        const nextVersion = Number(current.entry_version || 1) + 1;

        await trx("vocabulary_words")
          .where({ id: current.id })
          .update({
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
            normalized_term: normalizeVocabularyTerm(sample.word),
            sense_key: starterSenseKey(sample),
            sense_gloss: sample.englishMeaning,
            taxonomy_category_key: taxonomy.categoryKey,
            taxonomy_assignment_source: "starter-sample",
            taxonomy_assigned_at: new Date(),
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
      const senseRank = await allocatePersistentSenseRank(
        trx,
        userId,
        normalizedTerm,
      );
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
          normalized_term: normalizedTerm,
          sense_rank: senseRank,
          sense_key: starterSenseKey(sample),
          sense_gloss: sample.englishMeaning,
          taxonomy_category_key: taxonomy.categoryKey,
          taxonomy_assignment_source: "starter-sample",
          taxonomy_assigned_at: new Date(),
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

    await trx("starter_sample_preferences").where({ user_id: userId }).update({
      content_version: STARTER_SAMPLE_VERSION,
      updated_at: new Date(),
    });

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

    await trx("starter_sample_preferences")
      .insert({
        user_id: userId,
        enabled: false,
        content_version: STARTER_SAMPLE_VERSION,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict("user_id")
      .merge({
        enabled: false,
        content_version: STARTER_SAMPLE_VERSION,
        updated_at: new Date(),
      });

    return { removed: Number(removed || 0) };
  });
}

export async function synchronizeEnabledStarterSamples() {
  const enabledUsers = await database("starter_sample_preferences")
    .where({ enabled: true })
    .select("user_id");
  const results = [];
  for (const { user_id: userId } of enabledUsers) {
    results.push({ userId, ...(await loadStarterSamples(userId)) });
  }
  return results;
}
