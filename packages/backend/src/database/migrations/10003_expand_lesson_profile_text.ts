import type { Knex } from "knex";

// simplified-v2 stores full meaning and register explanations in these legacy
// projection columns, not short labels. Keep all validated lesson text intact.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE vocabulary_lessons
      ALTER COLUMN register TYPE TEXT,
      ALTER COLUMN word_nature TYPE TEXT
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // Deliberately retain the wider types. Older application versions can read
  // TEXT; restoring VARCHAR(150) would fail or truncate lessons imported since
  // this migration. No content is removed by rolling application code back.
}
