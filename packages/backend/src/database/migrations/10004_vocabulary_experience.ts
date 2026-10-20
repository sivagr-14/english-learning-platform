export async function up(knex: any): Promise<void> {
  await knex.schema.createTable("vocabulary_learner_state", (t: any) => {
    t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.uuid("word_id").notNullable().references("id").inTable("vocabulary_words").onDelete("CASCADE");
    t.string("familiarity", 20).notNullable().defaultTo("unassessed");
    t.text("note").notNullable().defaultTo("");
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.primary(["user_id", "word_id"]);
    t.index(["user_id", "familiarity"]);
  });
  await knex.schema.createTable("vocabulary_preferences", (t: any) => {
    t.uuid("user_id").primary().references("id").inTable("users").onDelete("CASCADE");
    t.string("accent", 10).notNullable().defaultTo("en-GB");
    t.boolean("show_tamil").notNullable().defaultTo(true);
    t.string("theme", 10).notNullable().defaultTo("light");
    t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.dropTableIfExists("vocabulary_preferences");
  await knex.schema.dropTableIfExists("vocabulary_learner_state");
}
