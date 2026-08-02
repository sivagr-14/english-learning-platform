import {
  DEFAULT_TAXONOMY_CATEGORY_KEY,
  legacyTaxonomyPath,
  TAXONOMY_DOMAINS,
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_USAGE_GROUPS,
} from "../../data/vocabulary-taxonomy";

async function synchronizeTaxonomy(knex: any) {
  await knex("vocabulary_taxonomy_domains")
    .insert(
      TAXONOMY_DOMAINS.map((domain) => ({
        domain_key: domain.key,
        name: domain.name,
        description: domain.description,
        sort_order: domain.sortOrder,
        is_active: true,
      })),
    )
    .onConflict("domain_key")
    .merge(["name", "description", "sort_order", "is_active"]);

  await knex("vocabulary_taxonomy_usage_groups")
    .insert(
      TAXONOMY_USAGE_GROUPS.map((group) => ({
        usage_group_key: group.key,
        domain_key: group.domainKey,
        name: group.name,
        description: group.description,
        sort_order: group.sortOrder,
        is_active: true,
      })),
    )
    .onConflict("usage_group_key")
    .merge(["domain_key", "name", "description", "sort_order", "is_active"]);

  for (
    let offset = 0;
    offset < TAXONOMY_SPECIFIC_CATEGORIES.length;
    offset += 100
  ) {
    await knex("vocabulary_taxonomy_categories")
      .insert(
        TAXONOMY_SPECIFIC_CATEGORIES.slice(offset, offset + 100).map(
          (category) => ({
            category_key: category.key,
            domain_key: category.domainKey,
            usage_group_key: category.usageGroupKey,
            name: category.name,
            description: category.description,
            aliases: category.aliases,
            sort_order: category.sortOrder,
            status: category.status,
            taxonomy_version: category.taxonomyVersion,
          }),
        ),
      )
      .onConflict("category_key")
      .merge([
        "domain_key",
        "usage_group_key",
        "name",
        "description",
        "aliases",
        "sort_order",
        "status",
        "taxonomy_version",
      ]);
  }
}

export async function up(knex: any): Promise<void> {
  await knex.schema.createTable("vocabulary_taxonomy_domains", (table: any) => {
    table.string("domain_key", 120).primary();
    table.string("name", 120).notNullable();
    table.text("description").notNullable();
    table.integer("sort_order").notNullable();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(
    "vocabulary_taxonomy_usage_groups",
    (table: any) => {
      table.string("usage_group_key", 180).primary();
      table
        .string("domain_key", 120)
        .notNullable()
        .references("domain_key")
        .inTable("vocabulary_taxonomy_domains")
        .onDelete("RESTRICT");
      table.string("name", 140).notNullable();
      table.text("description").notNullable();
      table.integer("sort_order").notNullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.timestamps(true, true);
      table.unique(["domain_key", "usage_group_key"]);
    },
  );

  await knex.schema.createTable(
    "vocabulary_taxonomy_categories",
    (table: any) => {
      table.string("category_key", 240).primary();
      table
        .string("domain_key", 120)
        .notNullable()
        .references("domain_key")
        .inTable("vocabulary_taxonomy_domains")
        .onDelete("RESTRICT");
      table
        .string("usage_group_key", 180)
        .notNullable()
        .references("usage_group_key")
        .inTable("vocabulary_taxonomy_usage_groups")
        .onDelete("RESTRICT");
      table.string("name", 160).notNullable();
      table.text("description").notNullable();
      table.specificType("aliases", "text[]").notNullable().defaultTo("{}");
      table.integer("sort_order").notNullable();
      table.string("status", 20).notNullable().defaultTo("active");
      table.string("taxonomy_version", 30).notNullable();
      table.timestamps(true, true);
      table.unique(["domain_key", "usage_group_key", "category_key"]);
    },
  );

  await synchronizeTaxonomy(knex);

  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table.string("taxonomy_category_key", 240).nullable();
    table
      .string("taxonomy_assignment_source", 40)
      .notNullable()
      .defaultTo("legacy-backfill");
    table
      .timestamp("taxonomy_assigned_at")
      .notNullable()
      .defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable("assessment_candidates", (table: any) => {
    table.string("taxonomy_version", 30).nullable();
    table.string("taxonomy_domain_key", 120).nullable();
    table.string("taxonomy_usage_group_key", 180).nullable();
    table.string("taxonomy_category_key", 240).nullable();
    table.string("taxonomy_confidence", 20).nullable();
    table.text("taxonomy_reason").nullable();
  });

  const existingWords = await knex("vocabulary_words as words")
    .leftJoin(
      "vocabulary_categories as categories",
      "words.category_id",
      "categories.id",
    )
    .select("words.id", "categories.category_name");

  for (const word of existingWords) {
    const taxonomy = legacyTaxonomyPath(word.category_name || undefined);
    await knex("vocabulary_words").where({ id: word.id }).update({
      taxonomy_category_key: taxonomy.categoryKey,
      taxonomy_assignment_source: "legacy-backfill",
      taxonomy_assigned_at: knex.fn.now(),
    });
  }

  await knex.raw(`
    ALTER TABLE vocabulary_words
      ALTER COLUMN taxonomy_category_key SET DEFAULT '${DEFAULT_TAXONOMY_CATEGORY_KEY}';
    ALTER TABLE vocabulary_words
      ALTER COLUMN taxonomy_category_key SET NOT NULL;
    ALTER TABLE vocabulary_words
      ADD CONSTRAINT vocabulary_words_taxonomy_category_fk
      FOREIGN KEY (taxonomy_category_key)
      REFERENCES vocabulary_taxonomy_categories(category_key)
      ON DELETE RESTRICT;

    ALTER TABLE assessment_candidates
      ADD CONSTRAINT assessment_candidates_taxonomy_path_fk
      FOREIGN KEY (
        taxonomy_domain_key,
        taxonomy_usage_group_key,
        taxonomy_category_key
      )
      REFERENCES vocabulary_taxonomy_categories(
        domain_key,
        usage_group_key,
        category_key
      )
      ON DELETE RESTRICT;

    CREATE INDEX vocabulary_words_taxonomy_category_idx
      ON vocabulary_words (taxonomy_category_key);
    CREATE INDEX assessment_candidates_taxonomy_category_idx
      ON assessment_candidates (taxonomy_category_key);
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS assessment_candidates_taxonomy_category_idx;
    DROP INDEX IF EXISTS vocabulary_words_taxonomy_category_idx;
    ALTER TABLE assessment_candidates
      DROP CONSTRAINT IF EXISTS assessment_candidates_taxonomy_path_fk;
    ALTER TABLE vocabulary_words
      DROP CONSTRAINT IF EXISTS vocabulary_words_taxonomy_category_fk;
  `);

  await knex.schema.alterTable("assessment_candidates", (table: any) => {
    table.dropColumns(
      "taxonomy_version",
      "taxonomy_domain_key",
      "taxonomy_usage_group_key",
      "taxonomy_category_key",
      "taxonomy_confidence",
      "taxonomy_reason",
    );
  });

  await knex.schema.alterTable("vocabulary_words", (table: any) => {
    table.dropColumns(
      "taxonomy_category_key",
      "taxonomy_assignment_source",
      "taxonomy_assigned_at",
    );
  });

  await knex.schema.dropTableIfExists("vocabulary_taxonomy_categories");
  await knex.schema.dropTableIfExists("vocabulary_taxonomy_usage_groups");
  await knex.schema.dropTableIfExists("vocabulary_taxonomy_domains");
}
