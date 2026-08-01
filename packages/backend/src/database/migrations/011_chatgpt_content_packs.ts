export async function up(knex: any): Promise<void> {
  await knex.schema.createTable("content_pack_manifests", (table: any) => {
    table.string("id", 120).primary();
    table
      .uuid("owner_user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .uuid("source_id")
      .nullable()
      .references("id")
      .inTable("content_sources")
      .onDelete("SET NULL");
    table
      .uuid("assessment_run_id")
      .nullable()
      .references("id")
      .inTable("assessment_runs")
      .onDelete("SET NULL");
    table.string("manifest_hash", 64).notNullable();
    table.string("source_name", 255).notNullable();
    table.string("source_type", 30).notNullable();
    table.string("status", 40).notNullable().defaultTo("unclaimed");
    table.jsonb("counts").notNullable();
    table.jsonb("payload").notNullable();
    table.jsonb("validation_report").notNullable().defaultTo("{}");
    table.timestamp("claimed_at").nullable();
    table.timestamp("approved_at").nullable();
    table.timestamp("completed_at").nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable("content_pack_batches", (table: any) => {
    table.string("id", 140).primary();
    table
      .string("manifest_id", 120)
      .notNullable()
      .references("id")
      .inTable("content_pack_manifests")
      .onDelete("CASCADE");
    table.integer("batch_number").notNullable();
    table.string("content_hash", 64).notNullable();
    table.string("manifest_hash", 64).notNullable();
    table.string("status", 40).notNullable().defaultTo("staged");
    table.integer("entry_count").notNullable();
    table.integer("committed_count").notNullable().defaultTo(0);
    table.jsonb("payload").notNullable();
    table.jsonb("validation_report").notNullable().defaultTo("{}");
    table.jsonb("committed_word_ids").notNullable().defaultTo("[]");
    table.timestamp("committed_at").nullable();
    table.timestamps(true, true);
    table.unique(["manifest_id", "batch_number"]);
  });

  await knex.schema.createTable("content_pack_ingest_errors", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("document_path", 500).notNullable();
    table.string("pack_id", 140).nullable();
    table.string("content_hash", 64).notNullable();
    table.string("status", 30).notNullable().defaultTo("active");
    table.jsonb("issues").notNullable();
    table.timestamps(true, true);
    table.unique(["document_path", "content_hash"]);
  });

  await knex.schema.alterTable("assessment_candidates", (table: any) => {
    table.string("external_candidate_id", 140).nullable();
    table.integer("occurrence_count").notNullable().defaultTo(1);
    table.jsonb("source_locations").notNullable().defaultTo("[]");
    table.text("decision_reason").nullable();
  });

  await knex.schema.alterTable("generation_job_items", (table: any) => {
    table
      .uuid("committed_word_id")
      .nullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("SET NULL");
    table.string("source_batch_id", 140).nullable();
  });

  await knex.raw(`
    CREATE UNIQUE INDEX assessment_candidates_run_external_unique
      ON assessment_candidates (assessment_run_id, external_candidate_id)
      WHERE external_candidate_id IS NOT NULL;
    CREATE INDEX content_pack_manifests_owner_status_idx
      ON content_pack_manifests (owner_user_id, status, created_at DESC);
    CREATE INDEX content_pack_batches_manifest_status_idx
      ON content_pack_batches (manifest_id, status, batch_number);
    CREATE INDEX content_pack_ingest_errors_status_idx
      ON content_pack_ingest_errors (status, updated_at DESC);
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(
    "DROP INDEX IF EXISTS assessment_candidates_run_external_unique",
  );
  await knex.schema.alterTable("generation_job_items", (table: any) => {
    table.dropColumns("committed_word_id", "source_batch_id");
  });
  await knex.schema.alterTable("assessment_candidates", (table: any) => {
    table.dropColumns(
      "external_candidate_id",
      "occurrence_count",
      "source_locations",
      "decision_reason",
    );
  });
  await knex.schema.dropTableIfExists("content_pack_batches");
  await knex.schema.dropTableIfExists("content_pack_ingest_errors");
  await knex.schema.dropTableIfExists("content_pack_manifests");
}
