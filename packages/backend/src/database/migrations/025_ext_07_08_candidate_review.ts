export async function up(knex: any): Promise<void> {
  await knex.schema.createTable(
    "generation_candidate_reviews",
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
        .notNullable()
        .references("id")
        .inTable("generation_candidate_decisions")
        .onDelete("CASCADE");
      table
        .uuid("reviewer_user_id")
        .notNullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table.integer("version").notNullable();
      table.string("action", 30).notNullable();
      table.jsonb("before_snapshot").notNullable();
      table.jsonb("after_snapshot").notNullable();
      table.text("reason").notNullable();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.unique(["candidate_decision_id", "version"]);
    },
  );
  await knex.schema.alterTable(
    "generation_candidate_decisions",
    (table: any) => {
      table.string("review_status", 30).notNullable().defaultTo("not_required");
      table.jsonb("review_override").nullable();
      table.integer("review_version").notNullable().defaultTo(0);
      table.timestamp("reviewed_at").nullable();
    },
  );
  await knex.schema.alterTable("generation_candidate_reviews", (table: any) => {
    table.index(
      ["generation_job_id", "created_at"],
      "generation_candidate_reviews_job_idx",
    );
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable(
    "generation_candidate_decisions",
    (table: any) => {
      table.dropColumn("reviewed_at");
      table.dropColumn("review_version");
      table.dropColumn("review_override");
      table.dropColumn("review_status");
    },
  );
  await knex.schema.dropTableIfExists("generation_candidate_reviews");
}
