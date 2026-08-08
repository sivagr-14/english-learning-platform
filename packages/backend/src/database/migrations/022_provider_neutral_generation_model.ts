const JOB_TABLES = [
  "generation_job_events",
  "generation_validation_failures",
  "generation_results",
  "generation_attempts",
  "generation_plan_members",
  "generation_plan_batches",
  "generation_candidate_occurrences",
  "generation_candidate_decisions",
  "generation_job_segments",
];

export async function up(knex: any): Promise<void> {
  await knex.raw("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.string("provider", 30).nullable();
    table.string("provider_model", 120).nullable();
    table.string("prompt_version", 80).nullable();
    table.string("contract_version", 80).nullable();
    table.string("manifest_identity", 64).nullable();
    table.string("policy_hash", 64).nullable();
    table.jsonb("policy_snapshot").nullable();
    table.string("manifest_id", 120).nullable();
  });

  await knex.schema.createTable("generation_job_segments", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("generation_job_id")
      .notNullable()
      .references("id")
      .inTable("generation_jobs")
      .onDelete("CASCADE");
    table.integer("sequence_number").notNullable();
    table.string("content_hash", 64).notNullable();
    table.text("original_text").nullable();
    table.text("normalized_text").nullable();
    table.jsonb("locator").notNullable().defaultTo("{}");
    table.string("status", 30).notNullable().defaultTo("pending");
    table.text("error").nullable();
    table.timestamps(true, true);
    table.unique(["generation_job_id", "sequence_number"]);
    table.unique(["generation_job_id", "content_hash", "sequence_number"]);
  });

  await knex.schema.createTable(
    "generation_candidate_decisions",
    (table: any) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("generation_job_id")
        .notNullable()
        .references("id")
        .inTable("generation_jobs")
        .onDelete("CASCADE");
      table
        .uuid("assessment_candidate_id")
        .nullable()
        .references("id")
        .inTable("assessment_candidates")
        .onDelete("SET NULL");
      table.string("external_candidate_id", 140).notNullable();
      table.string("normalized_term", 300).notNullable();
      table.string("sense_key", 180).notNullable();
      table.string("decision", 30).notNullable();
      table.string("reason_code", 80).nullable();
      table.text("reason").nullable();
      table.jsonb("snapshot").notNullable();
      table.timestamps(true, true);
      table.unique(["generation_job_id", "external_candidate_id"]);
      table.unique(["generation_job_id", "normalized_term", "sense_key"]);
    },
  );

  await knex.schema.createTable(
    "generation_candidate_occurrences",
    (table: any) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("candidate_decision_id")
        .notNullable()
        .references("id")
        .inTable("generation_candidate_decisions")
        .onDelete("CASCADE");
      table
        .uuid("segment_id")
        .nullable()
        .references("id")
        .inTable("generation_job_segments")
        .onDelete("SET NULL");
      table.integer("occurrence_number").notNullable();
      table.text("surface_form").notNullable();
      table.text("sentence").notNullable();
      table.jsonb("locator").notNullable().defaultTo("{}");
      table.timestamps(true, true);
      table.unique(["candidate_decision_id", "occurrence_number"]);
    },
  );

  await knex.schema.createTable("generation_plan_batches", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("generation_job_id")
      .notNullable()
      .references("id")
      .inTable("generation_jobs")
      .onDelete("CASCADE");
    table.integer("batch_number").notNullable();
    table.string("immutable_hash", 64).notNullable();
    table.string("status", 30).notNullable().defaultTo("planned");
    table.timestamps(true, true);
    table.unique(["generation_job_id", "batch_number"]);
  });

  await knex.schema.createTable("generation_plan_members", (table: any) => {
    table
      .uuid("batch_id")
      .notNullable()
      .references("id")
      .inTable("generation_plan_batches")
      .onDelete("CASCADE");
    table
      .uuid("candidate_decision_id")
      .notNullable()
      .references("id")
      .inTable("generation_candidate_decisions")
      .onDelete("CASCADE");
    table.integer("position").notNullable();
    table.primary(["batch_id", "candidate_decision_id"]);
    table.unique(["batch_id", "position"]);
    table.unique(["candidate_decision_id"]);
  });

  await knex.schema.createTable("generation_attempts", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("generation_job_id")
      .notNullable()
      .references("id")
      .inTable("generation_jobs")
      .onDelete("CASCADE");
    table
      .uuid("batch_id")
      .nullable()
      .references("id")
      .inTable("generation_plan_batches")
      .onDelete("SET NULL");
    table
      .uuid("candidate_decision_id")
      .nullable()
      .references("id")
      .inTable("generation_candidate_decisions")
      .onDelete("SET NULL");
    table.string("stage", 40).notNullable();
    table.integer("attempt_number").notNullable();
    table.string("provider", 30).notNullable();
    table.string("model", 120).notNullable();
    table.string("status", 30).notNullable();
    table.integer("input_tokens").notNullable().defaultTo(0);
    table.integer("output_tokens").notNullable().defaultTo(0);
    table.decimal("cost_usd", 14, 6).notNullable().defaultTo(0);
    table.string("error_code", 80).nullable();
    table.text("error_message").nullable();
    table.timestamp("started_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("completed_at").nullable();
    table.unique([
      "generation_job_id",
      "stage",
      "attempt_number",
      "candidate_decision_id",
    ]);
  });

  await knex.schema.createTable("generation_results", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("generation_job_id")
      .notNullable()
      .references("id")
      .inTable("generation_jobs")
      .onDelete("CASCADE");
    table
      .uuid("candidate_decision_id")
      .notNullable()
      .references("id")
      .inTable("generation_candidate_decisions")
      .onDelete("CASCADE");
    table
      .uuid("attempt_id")
      .nullable()
      .references("id")
      .inTable("generation_attempts")
      .onDelete("SET NULL");
    table.string("content_hash", 64).notNullable();
    table.jsonb("entry_payload").notNullable();
    table.string("validation_status", 30).notNullable().defaultTo("pending");
    table
      .uuid("committed_word_id")
      .nullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("SET NULL");
    table.timestamp("committed_at").nullable();
    table.timestamps(true, true);
    table.unique(["generation_job_id", "candidate_decision_id"]);
  });

  await knex.schema.createTable(
    "generation_validation_failures",
    (table: any) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("generation_job_id")
        .notNullable()
        .references("id")
        .inTable("generation_jobs")
        .onDelete("CASCADE");
      table
        .uuid("candidate_decision_id")
        .nullable()
        .references("id")
        .inTable("generation_candidate_decisions")
        .onDelete("SET NULL");
      table
        .uuid("attempt_id")
        .nullable()
        .references("id")
        .inTable("generation_attempts")
        .onDelete("SET NULL");
      table.string("code", 100).notNullable();
      table.string("path", 300).nullable();
      table.text("message").notNullable();
      table.jsonb("details").notNullable().defaultTo("{}");
      table.timestamp("resolved_at").nullable();
      table.timestamps(true, true);
    },
  );

  await knex.schema.createTable("generation_job_events", (table: any) => {
    table.bigIncrements("id").primary();
    table
      .uuid("generation_job_id")
      .notNullable()
      .references("id")
      .inTable("generation_jobs")
      .onDelete("CASCADE");
    table.string("event_type", 80).notNullable();
    table.string("stage", 40).nullable();
    table.jsonb("details").notNullable().defaultTo("{}");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    UPDATE generation_jobs
       SET provider = COALESCE(provider, CASE WHEN operation_id LIKE 'in-app:%' THEN 'gemini' ELSE 'chatgpt' END),
           provider_model = COALESCE(provider_model, CASE WHEN operation_id LIKE 'in-app:%' THEN 'legacy-configured-model' ELSE 'chatgpt' END),
           prompt_version = COALESCE(prompt_version, 'legacy'),
           contract_version = COALESCE(contract_version, 'legacy'),
           policy_snapshot = COALESCE(policy_snapshot, '{}'::jsonb),
           policy_hash = COALESCE(policy_hash, encode(digest(COALESCE(policy_snapshot, '{}'::jsonb)::text, 'sha256'), 'hex')),
           manifest_id = COALESCE(manifest_id, stage_progress->>'manifestId')
  `);
  await knex.raw(
    `CREATE INDEX generation_jobs_manifest_identity_idx ON generation_jobs (manifest_identity)`,
  );
  await knex.raw(
    `CREATE INDEX generation_job_events_job_created_idx ON generation_job_events (generation_job_id, created_at, id)`,
  );
  await knex.raw(
    `CREATE INDEX generation_validation_failures_open_idx ON generation_validation_failures (generation_job_id, resolved_at) WHERE resolved_at IS NULL`,
  );
  await knex.raw(`
    CREATE FUNCTION reject_generation_segment_mutation() RETURNS trigger AS $$
    BEGIN
      IF OLD.generation_job_id IS DISTINCT FROM NEW.generation_job_id
         OR OLD.sequence_number IS DISTINCT FROM NEW.sequence_number
         OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
         OR OLD.original_text IS DISTINCT FROM NEW.original_text
         OR OLD.normalized_text IS DISTINCT FROM NEW.normalized_text
         OR OLD.locator IS DISTINCT FROM NEW.locator THEN
        RAISE EXCEPTION 'generation segment ledger content is immutable';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER generation_job_segments_immutable
      BEFORE UPDATE ON generation_job_segments
      FOR EACH ROW EXECUTE FUNCTION reject_generation_segment_mutation();
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(
    "DROP TRIGGER IF EXISTS generation_job_segments_immutable ON generation_job_segments",
  );
  await knex.raw("DROP FUNCTION IF EXISTS reject_generation_segment_mutation");
  await knex.raw(
    "DROP INDEX IF EXISTS generation_validation_failures_open_idx",
  );
  await knex.raw("DROP INDEX IF EXISTS generation_job_events_job_created_idx");
  await knex.raw("DROP INDEX IF EXISTS generation_jobs_manifest_identity_idx");
  for (const table of JOB_TABLES) await knex.schema.dropTableIfExists(table);
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.dropColumns(
      "provider",
      "provider_model",
      "prompt_version",
      "contract_version",
      "manifest_identity",
      "policy_hash",
      "policy_snapshot",
      "manifest_id",
    );
  });
}
