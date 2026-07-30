const PROTOTYPE_WORDS = ["improve", "amount to", "trade-off", "bottleneck"];
const SAMPLE_EMAIL = "sample@example.com";

export async function up(knex: any): Promise<void> {
  // Only remove the known source-less prototype records. User-owned vocabulary
  // and registered personal accounts are deliberately left untouched.
  await knex("vocabulary_words")
    .whereNull("owner_user_id")
    .whereIn("word", PROTOTYPE_WORDS)
    .del();

  await knex("users").where({ email: SAMPLE_EMAIL }).del();
}

export async function down(): Promise<void> {
  // Prototype content is not restored. Real vocabulary is created through the
  // assessed and approved ChatGPT control workflow.
}
