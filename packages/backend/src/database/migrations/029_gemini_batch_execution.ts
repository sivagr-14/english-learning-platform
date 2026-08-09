export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.string("execution_mode_requested", 16).notNullable().defaultTo("auto");
    table.string("execution_mode_resolved", 16).nullable();
    table.string("provider_batch_id", 255).nullable();
    table.string("provider_batch_state", 64).nullable();
    table.timestamp("provider_batch_submitted_at").nullable();
    table.timestamp("provider_batch_polled_at").nullable();
  });
  await knex.schema.createTable("generation_provider_batch_requests", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("generation_job_id").notNullable().references("id").inTable("generation_jobs").onDelete("CASCADE");
    table.uuid("candidate_decision_id").notNullable().references("id").inTable("generation_candidate_decisions").onDelete("CASCADE");
    table.string("external_candidate_id", 140).notNullable();
    table.string("provider_batch_id", 255).notNullable();
    table.string("status", 32).notNullable().defaultTo("submitted");
    table.jsonb("provider_error").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.unique(["generation_job_id", "external_candidate_id"]);
  });
}
export async function down(knex: any): Promise<void> {
  await knex.schema.dropTableIfExists("generation_provider_batch_requests");
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.dropColumns("execution_mode_requested", "execution_mode_resolved", "provider_batch_id", "provider_batch_state", "provider_batch_submitted_at", "provider_batch_polled_at");
  });
}
