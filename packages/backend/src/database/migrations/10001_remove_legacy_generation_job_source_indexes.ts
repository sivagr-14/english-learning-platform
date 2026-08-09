/**
 * Finish the reassessment identity repair for databases created by every
 * historical generation_jobs migration variant.
 *
 * A source hash identifies reusable source content; it does not identify an
 * immutable assessment. ChatGPT reassessments and provider retries therefore
 * must not be unique by user/source/provider. Assessment-run identity remains
 * the durable idempotency boundary.
 */
export async function up(knex: any): Promise<void> {
  await knex.raw(`
    ALTER TABLE generation_jobs
      DROP CONSTRAINT IF EXISTS generation_jobs_user_id_source_hash_unique,
      DROP CONSTRAINT IF EXISTS idx_generation_jobs_user_source_hash,
      DROP CONSTRAINT IF EXISTS idx_generation_jobs_user_source_provider
  `);
  await knex.raw("DROP INDEX IF EXISTS idx_generation_jobs_user_source_hash");
  await knex.raw(
    "DROP INDEX IF EXISTS idx_generation_jobs_user_source_provider",
  );
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS
      generation_jobs_owner_assessment_unique
      ON generation_jobs (owner_user_id, assessment_run_id)
      WHERE owner_user_id IS NOT NULL AND assessment_run_id IS NOT NULL
  `);

}

export async function down(): Promise<void> {
  // Do not recreate source-level uniqueness.
}
