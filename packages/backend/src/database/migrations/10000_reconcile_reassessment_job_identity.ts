/**
 * Allow immutable reassessments of the same source to create independent jobs.
 *
 * content_sources remains deduplicated by owner/content hash. A generation job
 * belongs to an assessment/manifest revision, so user + source hash is too
 * coarse: a corrected exhaustive manifest legitimately has the same source.
 */
export async function up(knex: any): Promise<void> {
  await knex.raw(`
    ALTER TABLE generation_jobs
      DROP CONSTRAINT IF EXISTS generation_jobs_user_id_source_hash_unique
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      generation_jobs_owner_assessment_unique
      ON generation_jobs (owner_user_id, assessment_run_id)
  `);

  // These rows were created by the internal Gemini/Ollama transaction path
  // before the provider boundary was repaired. They are not GitHub inbox packs
  // and must not remain in the ChatGPT correction queue.
  await knex("content_pack_ingest_errors")
    .where({ status: "active" })
    .where("document_path", "like", "inapp/%")
    .update({ status: "resolved", updated_at: knex.fn.now() });
}

export async function down(knex: any): Promise<void> {
  await knex.raw(
    "DROP INDEX IF EXISTS generation_jobs_owner_assessment_unique",
  );

  // Do not recreate the obsolete user/source constraint: after this migration
  // valid immutable reassessments can produce multiple rows for one source, so
  // restoring it could destroy or reject legitimate durable history.
}
