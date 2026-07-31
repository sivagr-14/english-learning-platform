export async function up(knex: any): Promise<void> {
  await knex.raw(`
    UPDATE vocabulary_words
       SET cefr_level = UPPER(TRIM(cefr_level))
     WHERE cefr_level IS NOT NULL;

    INSERT INTO vocabulary_entry_categories
      (word_id, category_id, relationship, sort_order, created_at)
    SELECT id, category_id, 'primary', 0, NOW()
      FROM vocabulary_words
     WHERE category_id IS NOT NULL
    ON CONFLICT (word_id, category_id) DO UPDATE
      SET relationship = 'primary', sort_order = 0;

    ALTER TABLE vocabulary_words
      ADD CONSTRAINT vocabulary_words_cefr_level_valid
      CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
      NOT VALID;

    CREATE INDEX vocabulary_entry_categories_category_word_idx
      ON vocabulary_entry_categories (category_id, word_id);

    CREATE INDEX vocabulary_words_owner_word_lower_idx
      ON vocabulary_words (owner_user_id, LOWER(word), id);

    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE INDEX vocabulary_words_word_trgm_idx
      ON vocabulary_words USING GIN (word gin_trgm_ops);
    CREATE INDEX vocabulary_words_english_meaning_trgm_idx
      ON vocabulary_words USING GIN (english_meaning gin_trgm_ops);
    CREATE INDEX vocabulary_words_tamil_meaning_trgm_idx
      ON vocabulary_words USING GIN (tamil_meaning gin_trgm_ops);
    CREATE INDEX vocabulary_words_core_idea_trgm_idx
      ON vocabulary_words USING GIN (core_idea gin_trgm_ops);
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS vocabulary_words_core_idea_trgm_idx;
    DROP INDEX IF EXISTS vocabulary_words_tamil_meaning_trgm_idx;
    DROP INDEX IF EXISTS vocabulary_words_english_meaning_trgm_idx;
    DROP INDEX IF EXISTS vocabulary_words_word_trgm_idx;
    DROP INDEX IF EXISTS vocabulary_words_owner_word_lower_idx;
    DROP INDEX IF EXISTS vocabulary_entry_categories_category_word_idx;
    ALTER TABLE vocabulary_words
      DROP CONSTRAINT IF EXISTS vocabulary_words_cefr_level_valid;
  `);
}
