const CHATGPT_COLUMNS = [
  [
    "owner_user_id",
    (table: any) =>
      table
        .uuid("owner_user_id")
        .nullable()
        .references("id")
        .inTable("users")
        .onDelete("CASCADE"),
  ],
  [
    "assessment_run_id",
    (table: any) =>
      table
        .uuid("assessment_run_id")
        .nullable()
        .references("id")
        .inTable("assessment_runs")
        .onDelete("CASCADE"),
  ],
  ["operation_id", (table: any) => table.string("operation_id", 140).nullable()],
  ["total_items", (table: any) => table.integer("total_items").notNullable().defaultTo(0)],
  ["completed_items", (table: any) => table.integer("completed_items").notNullable().defaultTo(0)],
  ["failed_items", (table: any) => table.integer("failed_items").notNullable().defaultTo(0)],
  [
    "manual_review_items",
    (table: any) =>
      table.integer("manual_review_items").notNullable().defaultTo(0),
  ],
] as const;

async function addMissingColumn(
  knex: any,
  columnName: string,
  define: (table: any) => void,
): Promise<void> {
  if (await knex.schema.hasColumn("generation_jobs", columnName)) return;
  await knex.schema.alterTable("generation_jobs", define);
}

export async function up(knex: any): Promise<void> {
  if (!(await knex.schema.hasTable("generation_jobs"))) {
    throw new Error(
      "generation_jobs is missing after the foundation migrations; restore the database backup or run the migrations on a clean database",
    );
  }

  // Some installations ran older versions of migrations 006/018 before the
  // ChatGPT and in-app generation schemas were merged. Knex correctly records
  // those migrations as complete, so only a new forward migration can repair
  // the already-existing table without deleting either workflow's data.
  for (const [columnName, define] of CHATGPT_COLUMNS) {
    await addMissingColumn(knex, columnName, define);
  }

  const hasUserId = await knex.schema.hasColumn("generation_jobs", "user_id");
  if (hasUserId) {
    await knex.raw(`
      UPDATE generation_jobs
         SET owner_user_id = user_id
       WHERE owner_user_id IS NULL
         AND user_id IS NOT NULL
    `);
    await knex.raw(`
      UPDATE generation_jobs
         SET user_id = owner_user_id
       WHERE user_id IS NULL
         AND owner_user_id IS NOT NULL
    `);
  }

  await knex.raw(`
    UPDATE generation_jobs
       SET operation_id = 'legacy-generation:' || id::text
     WHERE operation_id IS NULL
  `);

  // In-app jobs do not have an assessment run. Keep the shared columns
  // nullable while ChatGPT service-level validation continues to supply them.
  await knex.raw(`
    ALTER TABLE generation_jobs ALTER COLUMN owner_user_id DROP NOT NULL;
    ALTER TABLE generation_jobs ALTER COLUMN assessment_run_id DROP NOT NULL;
    ALTER TABLE generation_jobs ALTER COLUMN operation_id DROP NOT NULL;
    ALTER TABLE generation_jobs ALTER COLUMN total_items SET DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS generation_jobs_owner_operation_unique
      ON generation_jobs (owner_user_id, operation_id)
      WHERE owner_user_id IS NOT NULL AND operation_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS generation_jobs_assessment_owner_idx
      ON generation_jobs (assessment_run_id, owner_user_id)
      WHERE assessment_run_id IS NOT NULL;
  `);
}

export async function down(knex: any): Promise<void> {
  if (!(await knex.schema.hasTable("generation_jobs"))) return;
  await knex.raw("DROP INDEX IF EXISTS generation_jobs_assessment_owner_idx");
  // The owner/operation uniqueness predates this repair on clean databases.
  // Preserve it, and preserve all repaired columns and data on rollback.
}
