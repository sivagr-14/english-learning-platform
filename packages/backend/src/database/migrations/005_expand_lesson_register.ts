export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("vocabulary_lessons", (table: any) => {
    table.string("register", 150).alter();
    table.string("word_nature", 150).alter();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("vocabulary_lessons", (table: any) => {
    table.string("register", 50).alter();
    table.string("word_nature", 100).alter();
  });
}
