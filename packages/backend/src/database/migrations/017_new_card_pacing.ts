export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("user_progress", (table: any) => {
    // Set only when a word is first surfaced to the learner as a due card.
    // Distinguishes "not_started and already queued today" from
    // "not_started and still waiting its turn" so /flashcards/due can cap
    // how many brand-new words enter rotation per day instead of flooding
    // the queue the moment a large import completes.
    table.timestamp("introduced_at").nullable();
  });
  await knex.schema.raw(
    "CREATE INDEX idx_user_progress_introduced_at ON user_progress(user_id, introduced_at)",
  );
}

export async function down(knex: any): Promise<void> {
  await knex.schema.raw("DROP INDEX IF EXISTS idx_user_progress_introduced_at");
  await knex.schema.alterTable("user_progress", (table: any) => {
    table.dropColumn("introduced_at");
  });
}
