export async function up(knex: any): Promise<void> {
  await knex.schema.createTable("starter_sample_preferences", (table: any) => {
    table
      .uuid("user_id")
      .primary()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.boolean("enabled").notNullable().defaultTo(false);
    table.integer("content_version").notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.raw(`
    INSERT INTO starter_sample_preferences
      (user_id, enabled, content_version, created_at, updated_at)
    SELECT DISTINCT owner_user_id, TRUE, 0, NOW(), NOW()
    FROM vocabulary_words
    WHERE owner_user_id IS NOT NULL AND is_starter_sample = TRUE
    ON CONFLICT (user_id) DO NOTHING
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.schema.dropTableIfExists("starter_sample_preferences");
}
