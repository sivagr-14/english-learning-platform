export async function up(knex: any): Promise<void> {
  await knex.schema.createTable("generation_jobs", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    // What was submitted.
    table.string("source_name", 255).notNullable();
    table.string("source_type", 20).notNullable(); // text | pdf | srt | docx | epub
    table.string("source_hash", 64).notNullable(); // sha256, reused for cross-user cache lookups later

    // Pipeline stage. Deliberately granular so the frontend can show real
    // progress instead of a single "processing" spinner for a whole book.
    table
      .enu("status", [
        "queued",
        "extracting",
        "assessing",
        "generating",
        "validating",
        "committed",
        "failed",
      ])
      .notNullable()
      .defaultTo("queued");

    // Free-form counters updated as the job progresses, e.g.
    // { chunksTotal, chunksProcessed, candidatesFound, lessonsGenerated,
    //   lessonsCommitted, lessonsFailedValidation }
    table.jsonb("stage_progress").notNullable().defaultTo("{}");

    // Cost tracking -- estimated before the expensive stages run, actual
    // accumulated as generation calls complete. Mirrors the columns already
    // present on chatgpt_generation_history so both flows report the same
    // shape to the UI.
    table.decimal("estimated_cost", 10, 4);
    table.decimal("actual_cost", 10, 4).notNullable().defaultTo(0);
    table.integer("tokens_used").notNullable().defaultTo(0);

    table.text("error_message");
    table.integer("attempt_count").notNullable().defaultTo(0);

    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("completed_at");

    table.unique(["user_id", "source_hash"]);
  });

  await knex.schema.raw(
    "CREATE INDEX idx_generation_jobs_user_status ON generation_jobs(user_id, status)",
  );
}

export async function down(knex: any): Promise<void> {
  await knex.schema.dropTableIfExists("generation_jobs");
}
