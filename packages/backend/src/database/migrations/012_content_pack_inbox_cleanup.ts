export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("content_pack_manifests", (table: any) => {
    table.timestamp("inbox_cleaned_at").nullable();
    table.string("inbox_cleanup_commit", 64).nullable();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("content_pack_manifests", (table: any) => {
    table.dropColumns("inbox_cleaned_at", "inbox_cleanup_commit");
  });
}
