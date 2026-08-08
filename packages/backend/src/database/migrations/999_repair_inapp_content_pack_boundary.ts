export async function up(knex: any): Promise<void> {
  const now = new Date();

  await knex("content_pack_manifests")
    .where("id", "like", "inapp-%")
    .update({
      inbox_branch: "inapp",
      sync_status: "synchronized",
      sync_error: null,
      updated_at: now,
    });

  await knex("content_pack_ingest_errors")
    .where("document_path", "like", "inapp/%")
    .where({ status: "active" })
    .update({ status: "resolved", updated_at: now });
}

export async function down(knex: any): Promise<void> {
  await knex("content_pack_manifests")
    .where("id", "like", "inapp-%")
    .update({
      inbox_branch: "chatgpt-content-inbox",
      updated_at: new Date(),
    });
}
