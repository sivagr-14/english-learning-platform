async function addColumnIfMissing(
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
      "generation_jobs must be created by 006_chatgpt_control_foundation before migration 018",
    );
  }

  // Migration 006 already owns generation_jobs for the ChatGPT control flow.
  // Extend that table in place so existing jobs and their assessment links are
  // preserved while the in-app generation flow gains its additional metadata.
  await addColumnIfMissing(knex, "user_id", (table) => {
    table
      .uuid("user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
  });
  await addColumnIfMissing(knex, "source_name", (table) => {
    table.string("source_name", 255).nullable();
  });
  await addColumnIfMissing(knex, "source_type", (table) => {
    table.string("source_type", 20).nullable();
  });
  await addColumnIfMissing(knex, "source_hash", (table) => {
    table.string("source_hash", 64).nullable();
  });
  await addColumnIfMissing(knex, "stage_progress", (table) => {
    table.jsonb("stage_progress").notNullable().defaultTo("{}");
  });
  await addColumnIfMissing(knex, "estimated_cost", (table) => {
    table.decimal("estimated_cost", 10, 4).nullable();
  });
  await addColumnIfMissing(knex, "actual_cost", (table) => {
    table.decimal("actual_cost", 10, 4).notNullable().defaultTo(0);
  });
  await addColumnIfMissing(knex, "tokens_used", (table) => {
    table.integer("tokens_used").notNullable().defaultTo(0);
  });
  await addColumnIfMissing(knex, "error_message", (table) => {
    table.text("error_message").nullable();
  });
  await addColumnIfMissing(knex, "attempt_count", (table) => {
    table.integer("attempt_count").notNullable().defaultTo(0);
  });
  await addColumnIfMissing(knex, "completed_at", (table) => {
    table.timestamp("completed_at").nullable();
  });

  // Existing ChatGPT rows already identify their owner through owner_user_id.
  // Gemini rows provide user_id directly; nullable source fields keep legacy
  // rows valid without inventing source metadata.
  await knex.raw(`
    UPDATE generation_jobs
       SET user_id = owner_user_id
     WHERE user_id IS NULL
       AND owner_user_id IS NOT NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_jobs_user_source_hash
      ON generation_jobs (user_id, source_hash)
      WHERE user_id IS NOT NULL AND source_hash IS NOT NULL
  `);
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_status
      ON generation_jobs (user_id, status)
  `);
}

export async function down(knex: any): Promise<void> {
  if (!(await knex.schema.hasTable("generation_jobs"))) return;

  await knex.raw("DROP INDEX IF EXISTS idx_generation_jobs_user_status");
  await knex.raw("DROP INDEX IF EXISTS idx_generation_jobs_user_source_hash");

  const columns = [
    "user_id",
    "source_name",
    "source_type",
    "source_hash",
    "stage_progress",
    "estimated_cost",
    "actual_cost",
    "tokens_used",
    "error_message",
    "attempt_count",
    "completed_at",
  ];
  const existing: string[] = [];
  for (const column of columns) {
    if (await knex.schema.hasColumn("generation_jobs", column)) existing.push(column);
  }
  if (existing.length > 0) {
    await knex.schema.alterTable("generation_jobs", (table: any) => {
      table.dropColumns(...existing);
    });
  }
}
