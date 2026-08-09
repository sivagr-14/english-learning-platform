export async function up(knex: any): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS idx_generation_jobs_user_source_hash");
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_jobs_user_source_provider
      ON generation_jobs (user_id, source_hash, provider)
      WHERE user_id IS NOT NULL AND source_hash IS NOT NULL AND provider IS NOT NULL
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS idx_generation_jobs_user_source_provider");
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_jobs_user_source_hash
      ON generation_jobs (user_id, source_hash)
      WHERE user_id IS NOT NULL AND source_hash IS NOT NULL
  `);
}
