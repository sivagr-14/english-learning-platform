export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.decimal("warning_budget_usd", 14, 6).nullable();
    table.decimal("hard_budget_usd", 14, 6).nullable();
    table.timestamp("budget_confirmed_at").nullable();
  });
  await knex.schema.alterTable("generation_attempts", (table: any) => {
    table.string("request_type", 40).notNullable().defaultTo("generation");
    table.integer("cached_tokens").notNullable().defaultTo(0);
    table.integer("latency_ms").notNullable().defaultTo(0);
    table.decimal("actual_cost_usd", 14, 6).nullable();
    table.string("prompt_version", 80).nullable();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_attempts", (table: any) => {
    table.dropColumns(
      "request_type",
      "cached_tokens",
      "latency_ms",
      "actual_cost_usd",
      "prompt_version",
    );
  });
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.dropColumns("warning_budget_usd", "hard_budget_usd", "budget_confirmed_at");
  });
}
