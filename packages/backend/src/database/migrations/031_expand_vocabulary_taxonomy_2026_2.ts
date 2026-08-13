import {
  TAXONOMY_DOMAINS,
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_USAGE_GROUPS,
} from "../../data/vocabulary-taxonomy";

/** Synchronize 2026.2 on installations where migration 016 already ran. */
export async function up(knex: any): Promise<void> {
  await knex("vocabulary_taxonomy_domains")
    .insert(
      TAXONOMY_DOMAINS.map((domain) => ({
        domain_key: domain.key,
        name: domain.name,
        description: domain.description,
        sort_order: domain.sortOrder,
        is_active: true,
        updated_at: knex.fn.now(),
      })),
    )
    .onConflict("domain_key")
    .merge(["name", "description", "sort_order", "is_active", "updated_at"]);

  await knex("vocabulary_taxonomy_usage_groups")
    .insert(
      TAXONOMY_USAGE_GROUPS.map((group) => ({
        usage_group_key: group.key,
        domain_key: group.domainKey,
        name: group.name,
        description: group.description,
        sort_order: group.sortOrder,
        is_active: true,
        updated_at: knex.fn.now(),
      })),
    )
    .onConflict("usage_group_key")
    .merge([
      "domain_key",
      "name",
      "description",
      "sort_order",
      "is_active",
      "updated_at",
    ]);

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
            updated_at: knex.fn.now(),
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
        "updated_at",
      ]);
  }
}

// New catalogue rows may be referenced by learner data. Never delete them on rollback.
export async function down(): Promise<void> {}
