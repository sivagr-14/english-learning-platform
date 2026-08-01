export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("assessment_runs", (table: any) => {
    table.jsonb("import_policy").nullable();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("assessment_runs", (table: any) => {
    table.dropColumn("import_policy");
  });
}

