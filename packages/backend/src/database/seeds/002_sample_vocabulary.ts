export async function seed(knex: any): Promise<void> {
  // @ts-ignore Knex loads TS seeds through ts-node in ESM mode.
  const { SAMPLE_VOCABULARY_LESSONS } = await import("../../data/vocabulary-lesson-samples.ts");

  await knex("vocabulary_words").del();

  const categories = await knex("vocabulary_categories");
  const categoryByName = new Map<string, any>(
    categories.map((category: any) => [category.category_name, category])
  );

  for (const lesson of SAMPLE_VOCABULARY_LESSONS) {
    const category = categoryByName.get(lesson.category);

    if (!category) {
      console.warn(`${lesson.category} category not found. Skipping seed.`);
      continue;
    }

    const [word] = await knex("vocabulary_words")
      .insert({
        category_id: category.id,
        word: lesson.word,
        pronunciation: lesson.pronunciation,
        word_type: lesson.word_type,
        cefr_level: lesson.cefr_level,
        frequency: lesson.frequency,
        english_meaning: lesson.english_meaning,
        tamil_meaning: lesson.tamil_meaning,
        core_idea: lesson.core_idea,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");

    await knex("vocabulary_lessons").insert({
      word_id: word.id,
      memory_trigger: lesson.memory_mastery.memory_trigger,
      visual_scene: lesson.memory_mastery.visual_scene,
      sound_association: lesson.memory_mastery.sound_association,
      tamil_connection: lesson.memory_mastery.tamil_connection,
      emotional_hook: lesson.memory_mastery.emotional_hook,
      memory_sentence: lesson.memory_mastery.memory_sentence,
      recall_question: lesson.memory_mastery.recall_question,
      pattern_family: lesson.memory_mastery.pattern_family,
      meaning_layer_1_literal: JSON.stringify({
        text: lesson.meaning_expansion.layer_1_literal,
      }),
      meaning_layer_2_abstract: JSON.stringify({
        text: lesson.meaning_expansion.layer_2_abstract,
      }),
      meaning_layer_3_figurative: JSON.stringify({
        text: lesson.meaning_expansion.layer_3_figurative,
      }),
      meaning_layer_4_professional: JSON.stringify({
        text: lesson.meaning_expansion.layer_4_professional_technical,
      }),
      usage_profile: JSON.stringify(lesson.usage_mastery.usage_profile),
      word_usage_zones: JSON.stringify(lesson.usage_mastery.word_usage_zone),
      natural_domains: lesson.usage_mastery.natural_domains,
      domain_restrictions: JSON.stringify(
        lesson.usage_mastery.domain_restrictions
      ),
      context_switching_test: JSON.stringify(
        lesson.usage_mastery.context_switching_test
      ),
      word_nature: lesson.usage_mastery.word_nature,
      register: lesson.usage_mastery.register,
      common_contexts: lesson.usage_mastery.common_contexts,
      tamil_usage_notes: lesson.usage_mastery.tamil_usage_notes,
      examples: JSON.stringify(lesson.application.examples),
      collocations: JSON.stringify(lesson.application.collocations),
      native_usage_patterns: lesson.application.native_usage_patterns.join("\n"),
      common_mistakes: JSON.stringify(lesson.application.common_mistakes),
      confusion_zone: lesson.application.confusion_zone,
      alternatives_synonyms: JSON.stringify(
        lesson.application.alternatives_synonyms
      ),
      frequency_by_context: JSON.stringify(
        lesson.application.frequency_by_context
      ),
      mini_conversation: lesson.mastery.mini_conversation,
      learn_pattern: lesson.mastery.learn_the_pattern.join("\n"),
      guided_practice: JSON.stringify(lesson.mastery.guided_practice),
      evaluation: JSON.stringify(lesson.mastery.evaluation),
      feedback_template: lesson.mastery.feedback,
      mastery_notes: lesson.mastery.mastery_notes,
      native_thinking_model: lesson.mastery.native_thinking_model,
      lesson_data: JSON.stringify(lesson),
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}
