export async function up(knex: any): Promise<void> {
  const hasDescription = await knex.schema.hasColumn(
    "vocabulary_categories",
    "description"
  );

  if (!hasDescription) {
    await knex.schema.alterTable("vocabulary_categories", (table: any) => {
      table.text("description");
    });
  }
}

export async function down(knex: any): Promise<void> {
  const hasDescription = await knex.schema.hasColumn(
    "vocabulary_categories",
    "description"
  );

  if (hasDescription) {
    await knex.schema.alterTable("vocabulary_categories", (table: any) => {
      table.dropColumn("description");
    });
  }
}
