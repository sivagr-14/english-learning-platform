export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("content_pack_manifests", (table: any) => {
    table
      .string("inbox_branch", 120)
      .notNullable()
      .defaultTo("chatgpt-content-inbox");
    table.string("fetched_commit", 64).nullable();
    table.timestamp("last_synced_at").nullable();
    table.string("sync_status", 30).notNullable().defaultTo("discovered");
    table.text("sync_error").nullable();
    table.timestamp("last_verified_at").nullable();
    table.jsonb("verification_report").notNullable().defaultTo("{}");
    table.integer("cleanup_attempts").notNullable().defaultTo(0);
    table.text("cleanup_error").nullable();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("content_pack_manifests", (table: any) => {
    table.dropColumns(
      "inbox_branch",
      "fetched_commit",
      "last_synced_at",
      "sync_status",
      "sync_error",
      "last_verified_at",
      "verification_report",
      "cleanup_attempts",
      "cleanup_error",
    );
  });
}
