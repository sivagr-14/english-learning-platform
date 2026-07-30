import bcrypt from "bcrypt";

const SAMPLE_EMAIL = "sample@example.com";
const SAMPLE_PASSWORD = "Password123";

export async function seed(knex: any): Promise<void> {
  const passwordHash = await bcrypt.hash(SAMPLE_PASSWORD, 10);
  const now = new Date();

  await knex("users")
    .insert({
      email: SAMPLE_EMAIL,
      username: "sample_user",
      password_hash: passwordHash,
      first_name: "Sample",
      last_name: "Learner",
      native_language: "Tamil",
      current_level: "A1",
      learning_goal: "Build everyday English vocabulary",
      email_verified: true,
      created_at: now,
      updated_at: now,
    })
    .onConflict("email")
    .merge({
      username: "sample_user",
      password_hash: passwordHash,
      first_name: "Sample",
      last_name: "Learner",
      native_language: "Tamil",
      current_level: "A1",
      learning_goal: "Build everyday English vocabulary",
      email_verified: true,
      updated_at: now,
    });

  const user = await knex("users").where({ email: SAMPLE_EMAIL }).first();
  const words = await knex("vocabulary_words").select("id", "category_id");

  for (const word of words.slice(0, 5)) {
    await knex("user_progress")
      .insert({
        user_id: user.id,
        word_id: word.id,
        category_id: word.category_id,
        status: "in_progress",
        proficiency_level: 1,
        times_reviewed: 1,
        times_correct: 1,
        next_review_at: now,
        created_at: now,
        updated_at: now,
      })
      .onConflict(["user_id", "word_id"])
      .merge({
        category_id: word.category_id,
        status: "in_progress",
        proficiency_level: 1,
        times_reviewed: 1,
        times_correct: 1,
        next_review_at: now,
        updated_at: now,
      });
  }
}
