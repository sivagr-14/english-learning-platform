import { up as synchronizeTaxonomy } from "./031_expand_vocabulary_taxonomy_2026_2";

export async function up(knex: any): Promise<void> {
  await synchronizeTaxonomy(knex);
  await knex.schema.createTable("fluency_collections", (t: any) => {
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.string("collection_id", 120).notNullable();
    t.string("content_hash", 64).notNullable();
    t.jsonb("payload").notNullable();
    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.primary(["user_id", "collection_id"]);
  });
  await knex.schema.createTable("fluency_collection_reviews", (t: any) => {
    t.uuid("user_id").notNullable();
    t.string("collection_id", 120).notNullable();
    t.string("manifest_id", 120).notNullable();
    t.integer("batch_number").notNullable();
    t.string("manifest_hash", 64).notNullable();
    t.string("content_hash", 64).notNullable();
    t.jsonb("payload").notNullable();
    t.primary(["user_id", "collection_id", "manifest_id", "batch_number"]);
    t.foreign(["user_id", "collection_id"])
      .references(["user_id", "collection_id"])
      .inTable("fluency_collections")
      .onDelete("CASCADE");
  });
  await knex.schema.createTable("fluency_profiles", (t: any) => {
    t.uuid("user_id")
      .primary()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.string("timezone", 100).notNullable().defaultTo("Europe/Warsaw");
    t.integer("daily_minutes").notNullable().defaultTo(20);
    t.integer("new_per_day").notNullable().defaultTo(10);
    t.string("focus", 40).notNullable().defaultTo("balanced");
    t.timestamps(true, true);
  });
  await knex.schema.createTable("fluency_skill_progress", (t: any) => {
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.uuid("word_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("CASCADE");
    t.string("skill", 20).notNullable();
    t.jsonb("state").notNullable();
    t.timestamp("due_at", { useTz: true }).notNullable();
    t.timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.primary(["user_id", "word_id", "skill"]);
    t.index(["user_id", "due_at"]);
  });
  await knex.schema.createTable("fluency_attempts", (t: any) => {
    t.uuid("id").notNullable();
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.uuid("word_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("CASCADE");
    t.string("skill", 20).notNullable();
    t.boolean("successful").notNullable();
    t.text("answer").notNullable();
    t.text("reflection").notNullable();
    t.string("context", 30).notNullable();
    t.string("phase", 20).notNullable();
    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.primary(["user_id", "id"]);
    t.index(["user_id", "word_id", "created_at"]);
  });
  await knex.schema.createTable("fluency_notes", (t: any) => {
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.uuid("word_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("CASCADE");
    t.text("personal_example").notNullable().defaultTo("");
    t.text("correction_request").notNullable().defaultTo("");
    t.specificType("tags", "text[]").notNullable().defaultTo("{}");
    t.string("learning_intent", 20).notNullable().defaultTo("active");
    t.timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.primary(["user_id", "word_id"]);
  });
  await knex.schema.createTable("flashcard_review_receipts", (t: any) => {
    t.uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.uuid("request_id").notNullable();
    t.uuid("word_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("CASCADE");
    t.string("rating", 20).notNullable();
    t.jsonb("result").notNullable();
    t.primary(["user_id", "request_id"]);
  });
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS user_progress_introduction_idx ON user_progress (user_id, introduced_at)",
  );
}

export async function down(knex: any): Promise<void> {
  for (const table of [
    "fluency_collection_reviews",
    "fluency_collections",
    "flashcard_review_receipts",
    "fluency_notes",
    "fluency_attempts",
    "fluency_skill_progress",
    "fluency_profiles",
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
  // Catalogue additions are retained because immutable imports may reference them.
}
