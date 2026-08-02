import assert from "assert";
import { randomUUID } from "crypto";
import {
  down as removeTaxonomy,
  up as applyTaxonomy,
} from "../database/migrations/016_three_level_vocabulary_taxonomy";
import { database } from "../utils/db";

async function main() {
  const suffix = randomUUID().slice(0, 8);
  let taxonomyApplied = true;
  let userId: string | null = null;

  try {
    await removeTaxonomy(database);
    taxonomyApplied = false;

    const [user] = await database("users")
      .insert({
        email: `taxonomy-migration-${suffix}@example.invalid`,
        username: `taxonomy-migration-${suffix}`,
        first_name: "Migration",
        email_verified: true,
      })
      .returning("*");
    userId = user.id;

    const category = await database("vocabulary_categories")
      .where({ category_name: "Travel & Transport" })
      .first();
    assert(category, "Legacy Travel & Transport category must exist");

    const [word] = await database("vocabulary_words")
      .insert({
        owner_user_id: user.id,
        category_id: category.id,
        word: "check in",
        pronunciation: "/tʃek ɪn/",
        word_type: "Phrasal verb",
        item_type: "phrasal verb",
        canonical_key: `check in|phrasal verb|migration-${suffix}`,
        base_form: "check in",
        normalized_term: "check in",
        sense_rank: 1,
        sense_key: `register-for-travel-${suffix}`,
        sense_gloss: "To register for a journey before departure.",
        cefr_level: "B1",
        frequency: "High",
        english_meaning: "To register before a flight or journey.",
        tamil_meaning: "பயணத்திற்கு முன் பதிவு செய்",
        core_idea: "Complete the required registration before travelling.",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    const [lesson] = await database("vocabulary_lessons")
      .insert({
        word_id: word.id,
        lesson_data: JSON.stringify({ migration_fixture: true }),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    const [progress] = await database("user_progress")
      .insert({
        user_id: user.id,
        word_id: word.id,
        category_id: category.id,
        status: "learning",
        proficiency_level: 2,
        times_reviewed: 3,
        times_correct: 2,
        times_incorrect: 1,
        next_review_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    const [queue] = await database("flashcard_queue")
      .insert({
        user_id: user.id,
        word_id: word.id,
        progress_id: progress.id,
        queue_position: 1,
        due_at: new Date(),
        card_type: "vocabulary",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    await applyTaxonomy(database);
    taxonomyApplied = true;

    const counts = {
      domains: Number(
        (
          await database("vocabulary_taxonomy_domains")
            .count({ count: "*" })
            .first()
        )?.count || 0,
      ),
      usageGroups: Number(
        (
          await database("vocabulary_taxonomy_usage_groups")
            .count({ count: "*" })
            .first()
        )?.count || 0,
      ),
      specificCategories: Number(
        (
          await database("vocabulary_taxonomy_categories")
            .count({ count: "*" })
            .first()
        )?.count || 0,
      ),
    };
    assert.deepEqual(counts, {
      domains: 15,
      usageGroups: 60,
      specificCategories: 300,
    });

    const migrated = await database("vocabulary_words as word")
      .join(
        "vocabulary_taxonomy_categories as category",
        "category.category_key",
        "word.taxonomy_category_key",
      )
      .join(
        "vocabulary_taxonomy_usage_groups as usage_group",
        "usage_group.usage_group_key",
        "category.usage_group_key",
      )
      .join(
        "vocabulary_taxonomy_domains as domain",
        "domain.domain_key",
        "category.domain_key",
      )
      .where("word.id", word.id)
      .select(
        "word.id",
        "word.taxonomy_assignment_source",
        "domain.domain_key",
        "usage_group.usage_group_key",
        "category.category_key",
      )
      .first();

    assert.deepEqual(migrated, {
      id: word.id,
      taxonomy_assignment_source: "legacy-backfill",
      domain_key: "travel",
      usage_group_key: "travel.planning_and_booking",
      category_key: "travel.planning_and_booking.trip_planning",
    });

    assert(
      await database("vocabulary_lessons").where({ id: lesson.id }).first(),
    );
    const preservedProgress = await database("user_progress")
      .where({ id: progress.id })
      .first();
    assert(preservedProgress);
    assert.equal(Number(preservedProgress.times_reviewed), 3);
    assert(await database("flashcard_queue").where({ id: queue.id }).first());

    const uncategorized = await database("vocabulary_words")
      .whereNull("taxonomy_category_key")
      .count({ count: "*" })
      .first();
    assert.equal(Number(uncategorized?.count || 0), 0);

    console.log(
      JSON.stringify({
        status: "passed",
        catalogue: "15 domains / 60 usage groups / 300 specific categories",
        existingEntryBackfill: "passed",
        lessonProgressAndFlashcardPreservation: "passed",
        uncategorizedEntries: 0,
      }),
    );
  } finally {
    if (!taxonomyApplied) {
      const hasTaxonomy = await database.schema.hasTable(
        "vocabulary_taxonomy_categories",
      );
      if (!hasTaxonomy) await applyTaxonomy(database);
    }
    if (userId) await database("users").where({ id: userId }).delete();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.destroy();
  });
