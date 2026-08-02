import {
  TAXONOMY_DOMAINS,
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_USAGE_GROUPS,
} from "../../data/vocabulary-taxonomy";

export async function seed(knex: any): Promise<void> {
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
    .merge();

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
    .merge();

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
      .merge();
  }
}
