import assert from "assert";
import { up, down } from "../database/migrations/10003_expand_lesson_profile_text";
import { database } from "../utils/db";

async function main() {
  // A connection-local temporary table shadows the real table for this test.
  // No learner rows or persistent schema are altered.
  await database.transaction(async (trx) => {
    await trx.raw(`CREATE TEMP TABLE vocabulary_lessons (
      word_id INTEGER PRIMARY KEY,
      register VARCHAR(150),
      word_nature VARCHAR(150),
      lesson_data JSONB
    ) ON COMMIT DROP`);
    const original = { word_id: 1, register: "Neutral", word_nature: "Literal" };
    await trx("vocabulary_lessons").insert(original);
    const register = "Professional wording: " + "Explain the appropriate audience and context. ".repeat(8);
    const meaning = "Contextual meaning: " + "A detailed explanation of the intended sense. ".repeat(8);
    for (const column of ["register", "word_nature"]) {
      await assert.rejects(
        trx.transaction(async (savepoint) => {
          await savepoint("vocabulary_lessons").insert({ word_id: 2, [column]: register });
        }),
        (error: any) => error.code === "22001",
        `${column} must reproduce the old length failure`,
      );
    }
    await up(trx);
    assert.deepStrictEqual(
      await trx("vocabulary_lessons").select("word_id", "register", "word_nature").where({ word_id: 1 }).first(),
      original,
    );
    const content = { overview: { meaning_usage_profile: { register, meaning_type: meaning } } };
    await trx("vocabulary_lessons").insert({
      word_id: 2, register, word_nature: meaning, lesson_data: JSON.stringify(content),
    });
    const revised = register + " Added nuance for the revision.";
    await trx("vocabulary_lessons").insert({ word_id: 2, register: revised, word_nature: meaning })
      .onConflict("word_id").merge(["register", "word_nature"]);
    await up(trx); // Reapplication is safe.
    await down(trx); // Rollback must not narrow or truncate stored content.
    const row = await trx("vocabulary_lessons").where({ word_id: 2 }).first();
    assert.strictEqual(row.register, revised);
    assert.strictEqual(row.word_nature, meaning);
    assert.deepStrictEqual(row.lesson_data, content);
    assert.strictEqual(Number((await trx("vocabulary_lessons").count("* as count").first())!.count), 2);
  });
  console.log("Lesson profile TEXT migration: insert, update and preservation checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => database.destroy());
