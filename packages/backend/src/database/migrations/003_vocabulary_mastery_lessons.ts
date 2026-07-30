export async function up(knex: any): Promise<void> {
  const hasLessonData = await knex.schema.hasColumn(
    "vocabulary_lessons",
    "lesson_data"
  );

  await knex.raw(`
    ALTER TABLE vocabulary_words
    ALTER COLUMN frequency DROP DEFAULT,
    ALTER COLUMN frequency TYPE VARCHAR(20)
      USING CASE
        WHEN frequency::text ~ '^[0-9]+$' AND frequency::integer >= 75 THEN 'High'
        WHEN frequency::text ~ '^[0-9]+$' AND frequency::integer >= 40 THEN 'Medium'
        WHEN frequency::text IN ('High', 'Medium', 'Low') THEN frequency::text
        ELSE 'Low'
      END,
    ALTER COLUMN frequency SET DEFAULT 'Medium'
  `);

  if (!hasLessonData) {
    await knex.schema.alterTable("vocabulary_lessons", (table: any) => {
      table.jsonb("lesson_data");
    });
  }
}

export async function down(knex: any): Promise<void> {
  const hasLessonData = await knex.schema.hasColumn(
    "vocabulary_lessons",
    "lesson_data"
  );

  if (hasLessonData) {
    await knex.schema.alterTable("vocabulary_lessons", (table: any) => {
      table.dropColumn("lesson_data");
    });
  }

  await knex.raw(`
    ALTER TABLE vocabulary_words
    ALTER COLUMN frequency DROP DEFAULT,
    ALTER COLUMN frequency TYPE INTEGER
      USING CASE
        WHEN frequency = 'High' THEN 100
        WHEN frequency = 'Medium' THEN 50
        ELSE 10
      END,
    ALTER COLUMN frequency SET DEFAULT 0
  `);
}
