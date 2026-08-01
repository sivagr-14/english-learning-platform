import { Knex } from "knex";
import { AppError } from "../middleware/error.middleware";

const FAVORITE_SYSTEM_KEY = "favorite";
const USER_CATEGORY_TRACK = "My Categories";

export interface UserCategory {
  id: string;
  category_name: string;
  description: string | null;
  color_code: string | null;
  is_default: boolean;
  word_count?: number;
}

export async function ensureFavoriteCategory(
  db: Knex | Knex.Transaction,
  userId: string,
): Promise<UserCategory> {
  const existing = await db("vocabulary_categories")
    .where({
      owner_user_id: userId,
      system_key: FAVORITE_SYSTEM_KEY,
      is_user_category: true,
    })
    .first();

  if (existing) return existing;

  const [created] = await db("vocabulary_categories")
    .insert({
      owner_user_id: userId,
      track_number: 1000,
      track_name: USER_CATEGORY_TRACK,
      category_number: 0,
      category_name: "Favorite",
      description: "Words saved for quick access and focused review.",
      difficulty_level: null,
      icon: "star",
      color_code: "#f59e0b",
      slug: `favorite-${userId}`,
      is_active: true,
      is_user_category: true,
      is_default: true,
      system_key: FAVORITE_SYSTEM_KEY,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict()
    .ignore()
    .returning("*");

  if (created) return created;

  const concurrent = await db("vocabulary_categories")
    .where({
      owner_user_id: userId,
      system_key: FAVORITE_SYSTEM_KEY,
      is_user_category: true,
    })
    .first();

  if (!concurrent) {
    throw new Error("Could not create the default Favorite category.");
  }
  return concurrent;
}

export async function listUserCategories(
  db: Knex,
  userId: string,
): Promise<UserCategory[]> {
  await ensureFavoriteCategory(db, userId);

  const rows = await db("vocabulary_categories as vc")
    .leftJoin("vocabulary_entry_categories as vec", "vc.id", "vec.category_id")
    .where({
      "vc.owner_user_id": userId,
      "vc.is_user_category": true,
      "vc.is_active": true,
    })
    .select(
      "vc.id",
      "vc.category_name",
      "vc.description",
      "vc.color_code",
      "vc.is_default",
    )
    .countDistinct({ word_count: "vec.word_id" })
    .groupBy("vc.id")
    .orderBy([
      { column: "vc.is_default", order: "desc" },
      { column: "vc.category_number", order: "asc" },
      { column: "vc.category_name", order: "asc" },
    ]);

  return rows.map((row: any) => ({
    ...row,
    is_default: Boolean(row.is_default),
    word_count: Number(row.word_count || 0),
  }));
}

export async function createUserCategory(
  db: Knex,
  userId: string,
  input: { name: string; description?: string },
): Promise<UserCategory> {
  return db.transaction((trx) =>
    createUserCategoryInTransaction(trx, userId, input),
  );
}

export async function addWordsToUserCategory(
  db: Knex,
  userId: string,
  wordIds: string[],
  target: { categoryId?: string; newCategoryName?: string } = {},
) {
  const uniqueWordIds = [...new Set(wordIds)];

  return db.transaction(async (trx) => {
    const category = target.newCategoryName
      ? await createUserCategoryInTransaction(trx, userId, {
          name: target.newCategoryName,
        })
      : target.categoryId
        ? await trx("vocabulary_categories")
            .where({
              id: target.categoryId,
              owner_user_id: userId,
              is_user_category: true,
              is_active: true,
            })
            .first()
        : await ensureFavoriteCategory(trx, userId);

    if (!category) {
      throw new AppError(404, "Personal category not found.");
    }

    const visibleWords = await trx("vocabulary_words")
      .whereIn("id", uniqueWordIds)
      .where((builder) =>
        builder.where("owner_user_id", userId).orWhereNull("owner_user_id"),
      )
      .select("id");

    if (visibleWords.length !== uniqueWordIds.length) {
      throw new AppError(
        404,
        "One or more vocabulary entries were not found for this account.",
      );
    }

    const inserted = await trx("vocabulary_entry_categories")
      .insert(
        uniqueWordIds.map((wordId) => ({
          word_id: wordId,
          category_id: category.id,
          relationship: "personal",
          sort_order: 100,
          created_at: new Date(),
        })),
      )
      .onConflict(["word_id", "category_id"])
      .ignore()
      .returning("word_id");

    return {
      category,
      requested: uniqueWordIds.length,
      added: inserted.length,
      already_present: uniqueWordIds.length - inserted.length,
    };
  });
}

async function createUserCategoryInTransaction(
  trx: Knex.Transaction,
  userId: string,
  input: { name: string; description?: string },
): Promise<UserCategory> {
  const name = normalizeDisplayName(input.name);
  const description = input.description?.trim() || null;

  if (name.toLocaleLowerCase() === "favorite") {
    throw new AppError(
      409,
      "Favorite already exists as your default category.",
    );
  }

  await ensureFavoriteCategory(trx, userId);

  const duplicate = await trx("vocabulary_categories")
    .where({ owner_user_id: userId, is_user_category: true })
    .whereRaw("LOWER(BTRIM(category_name)) = LOWER(BTRIM(?))", [name])
    .first();
  if (duplicate) {
    throw new AppError(409, `A category named "${name}" already exists.`);
  }

  const maximum = await trx("vocabulary_categories")
    .where({ owner_user_id: userId, is_user_category: true })
    .max({ category_number: "category_number" })
    .first();

  try {
    const [category] = await trx("vocabulary_categories")
      .insert({
        owner_user_id: userId,
        track_number: 1000,
        track_name: USER_CATEGORY_TRACK,
        category_number: Number(maximum?.category_number || 0) + 1,
        category_name: name,
        description,
        difficulty_level: null,
        icon: "folder",
        color_code: "#7c3aed",
        slug: null,
        is_active: true,
        is_user_category: true,
        is_default: false,
        system_key: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning("*");
    return category;
  } catch (error: any) {
    if (error?.code === "23505") {
      throw new AppError(409, `A category named "${name}" already exists.`);
    }
    throw error;
  }
}

function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
