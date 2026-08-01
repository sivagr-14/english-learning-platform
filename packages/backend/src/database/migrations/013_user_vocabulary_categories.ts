export async function up(knex: any): Promise<void> {
  await knex.schema.alterTable("vocabulary_categories", (table: any) => {
    table
      .uuid("owner_user_id")
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.boolean("is_user_category").notNullable().defaultTo(false);
    table.boolean("is_default").notNullable().defaultTo(false);
    table.string("system_key", 50).nullable();
  });

  await knex.raw(`
    CREATE UNIQUE INDEX vocabulary_categories_owner_name_unique
      ON vocabulary_categories (owner_user_id, LOWER(BTRIM(category_name)))
      WHERE owner_user_id IS NOT NULL;

    CREATE UNIQUE INDEX vocabulary_categories_owner_system_key_unique
      ON vocabulary_categories (owner_user_id, system_key)
      WHERE owner_user_id IS NOT NULL AND system_key IS NOT NULL;

    CREATE UNIQUE INDEX vocabulary_categories_one_default_per_owner
      ON vocabulary_categories (owner_user_id)
      WHERE owner_user_id IS NOT NULL AND is_default = TRUE;

    CREATE INDEX vocabulary_categories_owner_order_idx
      ON vocabulary_categories
        (owner_user_id, is_default DESC, category_number, category_name);

    INSERT INTO vocabulary_categories (
      owner_user_id,
      track_number,
      track_name,
      category_number,
      category_name,
      description,
      difficulty_level,
      icon,
      color_code,
      slug,
      is_active,
      is_user_category,
      is_default,
      system_key,
      created_at,
      updated_at
    )
    SELECT
      users.id,
      1000,
      'My Categories',
      0,
      'Favorite',
      'Words saved for quick access and focused review.',
      NULL,
      'star',
      '#f59e0b',
      'favorite-' || users.id::text,
      TRUE,
      TRUE,
      TRUE,
      'favorite',
      NOW(),
      NOW()
    FROM users
    ON CONFLICT DO NOTHING;
  `);
}

export async function down(knex: any): Promise<void> {
  await knex.raw(`
    DELETE FROM vocabulary_categories
     WHERE is_user_category = TRUE;

    DROP INDEX IF EXISTS vocabulary_categories_owner_order_idx;
    DROP INDEX IF EXISTS vocabulary_categories_one_default_per_owner;
    DROP INDEX IF EXISTS vocabulary_categories_owner_system_key_unique;
    DROP INDEX IF EXISTS vocabulary_categories_owner_name_unique;
  `);

  await knex.schema.alterTable("vocabulary_categories", (table: any) => {
    table.dropColumns(
      "owner_user_id",
      "is_user_category",
      "is_default",
      "system_key",
    );
  });
}
