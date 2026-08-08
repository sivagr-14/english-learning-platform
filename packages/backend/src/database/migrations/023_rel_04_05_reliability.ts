export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.timestamp("cancellation_requested_at").nullable();
    table.string("terminal_reason", 80).nullable();
    table.text("staged_upload_path").nullable();
    table.bigInteger("staged_upload_size").nullable();
    table.string("staged_upload_hash", 64).nullable();
    table.timestamp("staged_upload_parsed_at").nullable();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.dropColumns(
      "cancellation_requested_at",
      "terminal_reason",
      "staged_upload_path",
      "staged_upload_size",
      "staged_upload_hash",
      "staged_upload_parsed_at",
    );
  });
}
