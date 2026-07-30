export async function seed(knex: any): Promise<void> {
  // @ts-ignore Knex loads TS seeds through ts-node in ESM mode.
  const { KNOWLEDGE_VOCABULARY_CATEGORIES } = await import("../../data/vocabulary-lesson-samples.ts");

  await knex("vocabulary_categories").del();
  await knex("vocabulary_categories").insert(KNOWLEDGE_VOCABULARY_CATEGORIES);
}
