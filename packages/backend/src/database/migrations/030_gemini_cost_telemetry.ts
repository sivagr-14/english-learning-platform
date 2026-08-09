export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_attempts", (table: any) => {
    table.bigInteger("thinking_tokens").notNullable().defaultTo(0);
    table.string("execution_mode", 16).notNullable().defaultTo("standard");
    table.string("pricing_version", 32).nullable();
  });
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.string("cost_projection_basis", 16).nullable();
    table.integer("cost_projection_sample_size").notNullable().defaultTo(0);
    table.boolean("context_cache_enabled").notNullable().defaultTo(false);
    table.string("model_routing_reason", 80).nullable();
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("generation_jobs", (table: any) => {
    table.dropColumns("cost_projection_basis", "cost_projection_sample_size", "context_cache_enabled", "model_routing_reason");
  });
  await knex.schema.alterTable("generation_attempts", (table: any) => {
    table.dropColumns("thinking_tokens", "execution_mode", "pricing_version");
  });
}
