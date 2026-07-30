export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("vocabulary_categories", (table: any) => {
    table
      .uuid("parent_id")
      .nullable()
      .references("id")
      .inTable("vocabulary_categories")
      .onDelete("SET NULL");
    table.string("slug", 180).nullable();
    table.boolean("is_active").notNullable().defaultTo(true);
  });

  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table
      .uuid("owner_user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("canonical_key", 300).nullable();
    table.string("base_form", 255).nullable();
    table.string("item_type", 80).nullable();
    table.string("fluency_value", 30).nullable();
    table.string("learning_priority", 30).nullable();
    table.integer("entry_version").notNullable().defaultTo(1);
  });

  await knex.schema.createTable("content_sources", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("owner_user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("source_type", 30).notNullable();
    table.string("name", 255).notNullable();
    table.string("content_hash", 64).notNullable();
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamps(true, true);
    table.unique(["owner_user_id", "content_hash"]);
  });

  await knex.schema.createTable("source_segments", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("source_id")
      .notNullable()
      .references("id")
      .inTable("content_sources")
      .onDelete("CASCADE");
    table.integer("sequence_number").notNullable();
    table.text("content").nullable();
    table.jsonb("locator").notNullable().defaultTo("{}");
    table.timestamps(true, true);
    table.unique(["source_id", "sequence_number"]);
  });

  await knex.schema.createTable("assessment_runs", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("owner_user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("source_id")
      .notNullable()
      .references("id")
      .inTable("content_sources")
      .onDelete("CASCADE");
    table.string("operation_id", 120).notNullable();
    table.string("request_hash", 64).notNullable();
    table.string("status", 30).notNullable().defaultTo("assessed");
    table.jsonb("counts").notNullable();
    table.timestamp("approved_at").nullable();
    table.timestamp("completed_at").nullable();
    table.timestamps(true, true);
    table.unique(["owner_user_id", "operation_id"]);
  });

  await knex.schema.createTable("assessment_candidates", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("assessment_run_id")
      .notNullable()
      .references("id")
      .inTable("assessment_runs")
      .onDelete("CASCADE");
    table
      .uuid("source_segment_id")
      .nullable()
      .references("id")
      .inTable("source_segments")
      .onDelete("SET NULL");
    table
      .uuid("matched_word_id")
      .nullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("SET NULL");
    table.string("action", 20).notNullable();
    table.string("item", 255).notNullable();
    table.string("base_form", 255).nullable();
    table.string("item_type", 80).nullable();
    table.string("cefr_level", 10).nullable();
    table.string("usage_frequency", 30).nullable();
    table.string("fluency_value", 30).nullable();
    table.string("learning_priority", 30).nullable();
    table.text("contextual_meaning").nullable();
    table.text("original_sentence").nullable();
    table.jsonb("proposed_categories").notNullable().defaultTo("[]");
    table.string("status", 30).notNullable().defaultTo("proposed");
    table.text("filter_reason").nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable("vocabulary_entry_categories", (table: any) => {
    table
      .uuid("word_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("CASCADE");
    table
      .uuid("category_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_categories")
      .onDelete("CASCADE");
    table.string("relationship", 20).notNullable();
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.primary(["word_id", "category_id"]);
  });

  await knex.schema.createTable("vocabulary_entry_versions", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("word_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("CASCADE");
    table
      .uuid("changed_by_user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table
      .uuid("assessment_candidate_id")
      .nullable()
      .references("id")
      .inTable("assessment_candidates")
      .onDelete("SET NULL");
    table.integer("version_number").notNullable();
    table.string("change_type", 20).notNullable();
    table.jsonb("snapshot").notNullable();
    table.text("change_reason").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["word_id", "version_number"]);
  });

  await knex.schema.createTable("generation_jobs", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("owner_user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("assessment_run_id")
      .notNullable()
      .references("id")
      .inTable("assessment_runs")
      .onDelete("CASCADE");
    table.string("operation_id", 140).notNullable();
    table.string("status", 30).notNullable().defaultTo("approved");
    table.integer("total_items").notNullable();
    table.integer("completed_items").notNullable().defaultTo(0);
    table.integer("failed_items").notNullable().defaultTo(0);
    table.integer("manual_review_items").notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.unique(["owner_user_id", "operation_id"]);
  });

  await knex.schema.createTable("generation_job_items", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("generation_job_id")
      .notNullable()
      .references("id")
      .inTable("generation_jobs")
      .onDelete("CASCADE");
    table
      .uuid("assessment_candidate_id")
      .notNullable()
      .references("id")
      .inTable("assessment_candidates")
      .onDelete("CASCADE");
    table.string("status", 30).notNullable().defaultTo("pending");
    table.integer("attempt_count").notNullable().defaultTo(0);
    table.text("last_error").nullable();
    table.timestamp("completed_at").nullable();
    table.timestamps(true, true);
    table.unique(["generation_job_id", "assessment_candidate_id"]);
  });

  await knex.schema.createTable("control_audit_events", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("owner_user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("operation_id", 140).notNullable();
    table.string("event_type", 60).notNullable();
    table.string("entity_type", 50).notNullable();
    table.uuid("entity_id").nullable();
    table.jsonb("details").notNullable().defaultTo("{}");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE UNIQUE INDEX vocabulary_categories_slug_unique
      ON vocabulary_categories (LOWER(slug))
      WHERE slug IS NOT NULL;
    CREATE INDEX assessment_candidates_run_action_idx
      ON assessment_candidates (assessment_run_id, action, status);
    CREATE INDEX generation_job_items_status_idx
      ON generation_job_items (generation_job_id, status);
    CREATE INDEX vocabulary_words_owner_canonical_idx
      ON vocabulary_words (owner_user_id, canonical_key);
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS vocabulary_words_owner_canonical_idx");
  await knex.schema.dropTableIfExists("control_audit_events");
  await knex.schema.dropTableIfExists("generation_job_items");
  await knex.schema.dropTableIfExists("generation_jobs");
  await knex.schema.dropTableIfExists("vocabulary_entry_versions");
  await knex.schema.dropTableIfExists("vocabulary_entry_categories");
  await knex.schema.dropTableIfExists("assessment_candidates");
  await knex.schema.dropTableIfExists("assessment_runs");
  await knex.schema.dropTableIfExists("source_segments");
  await knex.schema.dropTableIfExists("content_sources");

  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table.dropColumns(
      "owner_user_id",
      "canonical_key",
      "base_form",
      "item_type",
      "fluency_value",
      "learning_priority",
      "entry_version",
    );
  });

  await knex.schema.alterTable("vocabulary_categories", (table: any) => {
    table.dropColumns("parent_id", "slug", "is_active");
  });
}
