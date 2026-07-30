export async function seed(knex: any): Promise<void> {
  // @ts-ignore Knex loads TS seeds through ts-node in ESM mode.
  const { KNOWLEDGE_VOCABULARY_CATEGORIES } =
    await import("../../data/vocabulary-lesson-samples");

  for (const category of KNOWLEDGE_VOCABULARY_CATEGORIES) {
    const existing = await knex("vocabulary_categories")
      .where({
        track_number: category.track_number,
        category_number: category.category_number,
      })
      .first();

    if (existing) {
      await knex("vocabulary_categories").where({ id: existing.id }).update({
        track_name: category.track_name,
        category_name: category.category_name,
        description: category.description,
        difficulty_level: category.difficulty_level,
        estimated_words_count: category.estimated_words_count,
        color_code: category.color_code,
        updated_at: knex.fn.now(),
      });
      continue;
    }

    await knex("vocabulary_categories").insert(category);
  }
}
