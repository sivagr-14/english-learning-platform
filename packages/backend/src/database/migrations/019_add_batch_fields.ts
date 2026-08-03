export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.string("processing_mode", 20).defaultTo("realtime");
    table.string("batch_id", 255).nullable();
    table.string("batch_status", 50).nullable();
    table.timestamp("batch_submission_time").nullable();
    table.timestamp("batch_estimated_completion").nullable();
    table.text("batch_error_message").nullable();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.dropColumn("processing_mode");
    table.dropColumn("batch_id");
    table.dropColumn("batch_status");
    table.dropColumn("batch_submission_time");
    table.dropColumn("batch_estimated_completion");
    table.dropColumn("batch_error_message");
  });
}
