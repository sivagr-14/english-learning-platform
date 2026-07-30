export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table.boolean("is_starter_sample").notNullable().defaultTo(false);
  });

  await knex.raw(`
    ALTER TABLE vocabulary_words
      DROP CONSTRAINT IF EXISTS vocabulary_words_category_id_word_unique;

    CREATE UNIQUE INDEX vocabulary_words_owned_category_word_unique
      ON vocabulary_words (owner_user_id, category_id, LOWER(word))
      WHERE owner_user_id IS NOT NULL;

    CREATE UNIQUE INDEX vocabulary_words_shared_category_word_unique
      ON vocabulary_words (category_id, LOWER(word))
      WHERE owner_user_id IS NULL;
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS vocabulary_words_owned_category_word_unique;
    DROP INDEX IF EXISTS vocabulary_words_shared_category_word_unique;
  `);

  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table.dropColumn("is_starter_sample");
    table.unique(["category_id", "word"]);
  });
}
