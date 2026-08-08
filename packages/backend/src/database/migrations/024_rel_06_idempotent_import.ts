export async function up(knex: any): Promise<void> {
  await knex.schema.createTable("content_pack_entry_receipts", (table: any) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("manifest_id", 120).notNullable();
    table.string("batch_id", 140).notNullable();
    table.string("candidate_id", 140).notNullable();
    table.string("content_hash", 64).notNullable();
    table
      .uuid("word_id")
      .notNullable()
      .references("id")
      .inTable("vocabulary_words")
      .onDelete("CASCADE");
    table.timestamp("verified_at").nullable();
    table.jsonb("verification_report").notNullable().defaultTo("{}");
    table.timestamps(true, true);
    table.unique(["manifest_id", "candidate_id"]);
    table.unique(["batch_id", "candidate_id"]);
  });

  await knex.schema.alterTable("content_pack_batches", (table: any) => {
    table.timestamp("readback_verified_at").nullable();
    table.jsonb("readback_report").notNullable().defaultTo("{}");
  });
}

export async function down(knex: any): Promise<void> {
  await knex.schema.alterTable("content_pack_batches", (table: any) => {
    table.dropColumns("readback_verified_at", "readback_report");
  });
  await knex.schema.dropTableIfExists("content_pack_entry_receipts");
}
