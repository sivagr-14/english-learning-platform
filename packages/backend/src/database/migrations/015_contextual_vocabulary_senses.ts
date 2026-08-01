export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table.string("normalized_term", 255).nullable();
    table.integer("sense_rank").notNullable().defaultTo(1);
    table.string("sense_key", 180).nullable();
    table.text("sense_gloss").nullable();
  });

  await knex.schema.alterTable("assessment_candidates", (table: any) => {
    table.string("sense_decision", 30).nullable();
    table.string("sense_key", 180).nullable();
    table.jsonb("sense_evidence").nullable();
    table.integer("allocated_sense_rank").nullable();
  });

  await knex.raw(`
    UPDATE vocabulary_words
    SET normalized_term = LOWER(REGEXP_REPLACE(BTRIM(word), '\\s+', ' ', 'g'))
    WHERE normalized_term IS NULL;

    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY owner_user_id,
            LOWER(REGEXP_REPLACE(BTRIM(word), '\\s+', ' ', 'g'))
          ORDER BY created_at, id
        ) AS allocated_rank
      FROM vocabulary_words
    )
    UPDATE vocabulary_words AS words
    SET sense_rank = ranked.allocated_rank
    FROM ranked
    WHERE words.id = ranked.id;

    ALTER TABLE vocabulary_words
      ALTER COLUMN normalized_term SET NOT NULL;
    ALTER TABLE vocabulary_words
      ADD CONSTRAINT vocabulary_words_sense_rank_positive
      CHECK (sense_rank > 0);

    ALTER TABLE vocabulary_words
      DROP CONSTRAINT IF EXISTS vocabulary_words_category_id_word_key;
    ALTER TABLE vocabulary_words
      DROP CONSTRAINT IF EXISTS vocabulary_words_category_id_word_unique;
    DROP INDEX IF EXISTS vocabulary_words_owned_category_word_unique;
    DROP INDEX IF EXISTS vocabulary_words_shared_category_word_unique;

    CREATE UNIQUE INDEX vocabulary_words_owned_term_rank_unique
      ON vocabulary_words (owner_user_id, normalized_term, sense_rank)
      WHERE owner_user_id IS NOT NULL;
    CREATE UNIQUE INDEX vocabulary_words_shared_term_rank_unique
      ON vocabulary_words (category_id, normalized_term, sense_rank)
      WHERE owner_user_id IS NULL;
    CREATE UNIQUE INDEX vocabulary_words_owned_term_sense_key_unique
      ON vocabulary_words (owner_user_id, normalized_term, sense_key)
      WHERE owner_user_id IS NOT NULL AND sense_key IS NOT NULL;
    CREATE UNIQUE INDEX vocabulary_words_shared_term_sense_key_unique
      ON vocabulary_words (category_id, normalized_term, sense_key)
      WHERE owner_user_id IS NULL AND sense_key IS NOT NULL;
    CREATE INDEX vocabulary_words_normalized_term_idx
      ON vocabulary_words (normalized_term, sense_rank);
  `);

  await knex.schema.createTable("vocabulary_sense_counters", (table: any) => {
    table
      .uuid("owner_user_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("normalized_term", 255).notNullable();
    table.integer("next_rank").notNullable();
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.primary(["owner_user_id", "normalized_term"]);
  });

  await knex.raw(`
    INSERT INTO vocabulary_sense_counters (
      owner_user_id,
      normalized_term,
      next_rank,
      updated_at
    )
    SELECT
      owner_user_id,
      normalized_term,
      MAX(sense_rank) + 1,
      CURRENT_TIMESTAMP
    FROM vocabulary_words
    WHERE owner_user_id IS NOT NULL
    GROUP BY owner_user_id, normalized_term;
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.schema.dropTableIfExists("vocabulary_sense_counters");

  await knex.raw(`
    DROP INDEX IF EXISTS vocabulary_words_normalized_term_idx;
    DROP INDEX IF EXISTS vocabulary_words_shared_term_sense_key_unique;
    DROP INDEX IF EXISTS vocabulary_words_owned_term_sense_key_unique;
    DROP INDEX IF EXISTS vocabulary_words_shared_term_rank_unique;
    DROP INDEX IF EXISTS vocabulary_words_owned_term_rank_unique;
    ALTER TABLE vocabulary_words
      DROP CONSTRAINT IF EXISTS vocabulary_words_sense_rank_positive;
  `);

  await knex.schema.alterTable("assessment_candidates", (table: any) => {
    table.dropColumns(
      "sense_decision",
      "sense_key",
      "sense_evidence",
      "allocated_sense_rank",
    );
  });

  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table.dropColumns(
      "normalized_term",
      "sense_rank",
      "sense_key",
      "sense_gloss",
    );
  });

  await knex.raw(`
    CREATE UNIQUE INDEX vocabulary_words_owned_category_word_unique
      ON vocabulary_words (owner_user_id, category_id, LOWER(word))
      WHERE owner_user_id IS NOT NULL;
    CREATE UNIQUE INDEX vocabulary_words_shared_category_word_unique
      ON vocabulary_words (category_id, LOWER(word))
      WHERE owner_user_id IS NULL;
  `);
}
