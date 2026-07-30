import fs from "fs";
import path from "path";

export async function up(knex: any): Promise<void> {
  const schemaCandidates = [
    path.resolve(process.cwd(), "src/database/schema.sql"),
    path.resolve(process.cwd(), "dist/database/schema.sql"),
    path.resolve(process.cwd(), "packages/backend/src/database/schema.sql"),
  ];
  const schemaPath = schemaCandidates.find((candidate) =>
    fs.existsSync(candidate)
  );

  if (!schemaPath) {
    throw new Error("Could not find database schema.sql");
  }

  const schema = fs.readFileSync(schemaPath, "utf-8");

  await knex.raw(schema);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(`
    DROP TABLE IF EXISTS user_grammar_progress CASCADE;
    DROP TABLE IF EXISTS communication_topics CASCADE;
    DROP TABLE IF EXISTS grammar_topics CASCADE;
    DROP TABLE IF EXISTS translation_cache CASCADE;
    DROP TABLE IF EXISTS chatgpt_generation_history CASCADE;
    DROP TABLE IF EXISTS chatgpt_generation_queue CASCADE;
    DROP TABLE IF EXISTS learning_paths CASCADE;
    DROP TABLE IF EXISTS learning_sessions CASCADE;
    DROP TABLE IF EXISTS flashcard_queue CASCADE;
    DROP TABLE IF EXISTS user_progress CASCADE;
    DROP TABLE IF EXISTS vocabulary_lessons CASCADE;
    DROP TABLE IF EXISTS vocabulary_words CASCADE;
    DROP TABLE IF EXISTS vocabulary_categories CASCADE;
    DROP TABLE IF EXISTS magic_links CASCADE;
    DROP TABLE IF EXISTS user_sessions CASCADE;
    DROP TABLE IF EXISTS oauth_accounts CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
}
