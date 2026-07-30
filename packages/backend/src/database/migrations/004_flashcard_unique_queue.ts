export async function up(knex: any): Promise<void> {
  await knex.raw(`
    ALTER TABLE flashcard_queue
    ADD CONSTRAINT flashcard_queue_user_word_unique UNIQUE (user_id, word_id)
  `).catch(() => undefined);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(`
    ALTER TABLE flashcard_queue
    DROP CONSTRAINT IF EXISTS flashcard_queue_user_word_unique
  `);
}
