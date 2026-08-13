import assert from "assert";
import { randomUUID } from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { errorHandler } from "../middleware/error.middleware";
import flashcardRouter from "../routes/flashcards";
import progressRouter from "../routes/progress";
import vocabularyRouter from "../routes/vocabulary";
import { loadStarterSamples } from "../services/starter-samples.service";
import {
  addWordsToUserCategory,
  createUserCategory,
  ensureFavoriteCategory,
  listUserCategories,
} from "../services/user-category.service";
import { database } from "../utils/db";
import { closeRedis } from "../utils/redis";

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const [owner] = await database("users")
    .insert({
      email: `category-owner-${suffix}@example.invalid`,
      username: `category-owner-${suffix}`,
      first_name: "Category",
      email_verified: true,
    })
    .returning("*");
  const [otherUser] = await database("users")
    .insert({
      email: `category-other-${suffix}@example.invalid`,
      username: `category-other-${suffix}`,
      first_name: "Isolation",
      email_verified: true,
    })
    .returning("*");

  try {
    await loadStarterSamples(owner.id);
    const words = await database("vocabulary_words")
      .where({ owner_user_id: owner.id })
      .orderBy("word")
      .limit(2)
      .select("id", "category_id", "taxonomy_category_key");
    assert.equal(words.length, 2);
    const wordIds = words.map((word) => word.id);
    const originalPrimaryIds = new Map(
      words.map((word) => [word.id, word.category_id]),
    );

    const favorites = await Promise.all(
      Array.from({ length: 5 }, () =>
        ensureFavoriteCategory(database, owner.id),
      ),
    );
    assert.equal(new Set(favorites.map((category) => category.id)).size, 1);
    const favorite = favorites[0];

    const customAdd = await addWordsToUserCategory(
      database,
      owner.id,
      wordIds,
      { newCategoryName: "  Travel   Focus  " },
    );
    const custom = customAdd.category;
    assert.equal(custom.category_name, "Travel Focus");
    assert.equal(customAdd.added, 2);
    await assert.rejects(
      () => createUserCategory(database, owner.id, { name: "travel focus" }),
      /already exists/i,
    );
    await assert.rejects(
      () => createUserCategory(database, owner.id, { name: "FAVORITE" }),
      /already exists/i,
    );

    const firstFavoriteAdd = await addWordsToUserCategory(database, owner.id, [
      ...wordIds,
      wordIds[0],
    ]);
    assert.equal(firstFavoriteAdd.requested, 2);
    assert.equal(firstFavoriteAdd.added, 2);

    const duplicateFavoriteAdd = await addWordsToUserCategory(
      database,
      owner.id,
      wordIds,
      { categoryId: favorite.id },
    );
    assert.equal(duplicateFavoriteAdd.added, 0);
    assert.equal(duplicateFavoriteAdd.already_present, 2);

    for (const word of words) {
      const links = await database("vocabulary_entry_categories")
        .where({ word_id: word.id })
        .select("category_id", "relationship");
      assert.equal(links.length, 3);
      assert.equal(
        links.filter((link) => link.relationship === "primary").length,
        1,
      );
      assert.equal(
        links.filter((link) => link.relationship === "personal").length,
        2,
      );
      assert(links.some((link) => link.category_id === favorite.id));
      assert(links.some((link) => link.category_id === custom.id));

      const storedWord = await database("vocabulary_words")
        .where({ id: word.id })
        .first();
      assert.equal(storedWord.category_id, originalPrimaryIds.get(word.id));
    }

    const [firstLesson] = await database("vocabulary_lessons")
      .where({ word_id: wordIds[0] })
      .select("lesson_data");
    await database("vocabulary_lessons")
      .where({ word_id: wordIds[0] })
      .update({
        lesson_data: JSON.stringify({
          ...firstLesson.lesson_data,
          sample_version: 0,
        }),
      });
    await loadStarterSamples(owner.id);
    const linksAfterRefresh = await database("vocabulary_entry_categories")
      .where({ word_id: wordIds[0] })
      .select("category_id", "relationship");
    assert.equal(linksAfterRefresh.length, 3);
    assert(
      linksAfterRefresh.some(
        (link) =>
          link.category_id === favorite.id && link.relationship === "personal",
      ),
    );
    assert(
      linksAfterRefresh.some(
        (link) =>
          link.category_id === custom.id && link.relationship === "personal",
      ),
    );

    const otherFavorite = await ensureFavoriteCategory(database, otherUser.id);
    await assert.rejects(
      () =>
        addWordsToUserCategory(database, otherUser.id, wordIds, {
          categoryId: otherFavorite.id,
        }),
      /not found for this account/i,
    );
    await assert.rejects(
      () =>
        addWordsToUserCategory(database, otherUser.id, wordIds, {
          newCategoryName: "Must Roll Back",
        }),
      /not found for this account/i,
    );
    const rolledBackCategory = await database("vocabulary_categories")
      .where({ owner_user_id: otherUser.id })
      .whereRaw("LOWER(category_name) = LOWER(?)", ["Must Roll Back"])
      .first();
    assert.equal(rolledBackCategory, undefined);
    await assert.rejects(
      () =>
        addWordsToUserCategory(database, otherUser.id, wordIds, {
          categoryId: custom.id,
        }),
      /category not found/i,
    );

    const personalCategories = await listUserCategories(database, owner.id);
    assert.equal(personalCategories.length, 2);
    assert.equal(personalCategories[0].id, favorite.id);
    assert.equal(personalCategories[0].word_count, 2);

    const availableSystemCategory = await database("vocabulary_categories")
      .whereNull("owner_user_id")
      .where({ is_active: true })
      .whereNotIn(
        "id",
        words.map((word) => word.category_id),
      )
      .orderBy("category_number")
      .first();
    assert(availableSystemCategory);

    const app = express();
    app.use(express.json());
    app.use("/api/vocabulary", vocabularyRouter);
    app.use("/api/flashcards", flashcardRouter);
    app.use("/api/progress", progressRouter);
    app.use(errorHandler);
    const token = jwt.sign(
      { userId: owner.id },
      process.env.JWT_SECRET as string,
    );
    const authorization = { Authorization: `Bearer ${token}` };

    const emptyCategoryResponse = await request(app)
      .post("/api/vocabulary/user-categories")
      .set(authorization)
      .send({
        name: "Empty Study Focus",
        description: "Created directly from the Categories page.",
      })
      .expect(201);
    const emptyCategory = emptyCategoryResponse.body.category;

    const categoryListResponse = await request(app)
      .get("/api/vocabulary/categories")
      .set(authorization)
      .expect(200);
    assert(
      categoryListResponse.body.categories.some(
        (category: any) =>
          category.id === favorite.id && Number(category.word_count) === 2,
      ),
    );
    assert(
      categoryListResponse.body.categories.some(
        (category: any) =>
          category.id === custom.id && Number(category.word_count) === 2,
      ),
    );
    assert(
      categoryListResponse.body.categories.some(
        (category: any) =>
          category.id === emptyCategory.id &&
          category.is_user_category &&
          Number(category.word_count) === 0,
      ),
    );

    const completeCategoryListResponse = await request(app)
      .get("/api/vocabulary/categories?includeEmpty=true")
      .set(authorization)
      .expect(200);
    assert(
      completeCategoryListResponse.body.categories.some(
        (category: any) => category.id === availableSystemCategory.id,
      ),
    );

    const taxonomyResponse = await request(app)
      .get("/api/vocabulary/taxonomy")
      .set(authorization)
      .expect(200);
    assert.deepEqual(taxonomyResponse.body.counts, {
      domains: 22,
      usage_groups: 60,
      specific_categories: 300,
    });
    assert.equal(taxonomyResponse.body.domains.length, 22);
    assert(
      taxonomyResponse.body.domains.every(
        (domain: any) =>
          domain.usage_groups.length === 4 &&
          domain.usage_groups.every(
            (group: any) => group.categories.length === 5,
          ),
      ),
    );

    const taxonomyWordsResponse = await request(app)
      .get(
        `/api/vocabulary/taxonomy/${encodeURIComponent(
          words[0].taxonomy_category_key,
        )}/words`,
      )
      .set(authorization)
      .expect(200);
    assert(
      taxonomyWordsResponse.body.words.some(
        (word: any) => word.id === words[0].id,
      ),
    );

    const assignSystemCategoryResponse = await request(app)
      .post("/api/vocabulary/words/categories")
      .set(authorization)
      .send({ wordIds, categoryId: availableSystemCategory.id })
      .expect(200);
    assert.equal(assignSystemCategoryResponse.body.added, 2);
    const assignedLinks = await database("vocabulary_entry_categories")
      .whereIn("word_id", wordIds)
      .where({
        category_id: availableSystemCategory.id,
        relationship: "assigned",
      });
    assert.equal(assignedLinks.length, 2);

    const favoriteWordsResponse = await request(app)
      .get(`/api/vocabulary/categories/${favorite.id}/words`)
      .set(authorization)
      .expect(200);
    assert.equal(favoriteWordsResponse.body.pagination.total, 2);

    const reviewCategoriesResponse = await request(app)
      .get("/api/flashcards/categories")
      .set(authorization)
      .expect(200);
    assert(
      reviewCategoriesResponse.body.categories.some(
        (category: any) =>
          category.id === favorite.id && Number(category.due_count) === 2,
      ),
    );
    const favoriteCardsResponse = await request(app)
      .get(`/api/flashcards/due?categoryId=${favorite.id}`)
      .set(authorization)
      .expect(200);
    assert.equal(favoriteCardsResponse.body.cards.length, 2);

    const progressResponse = await request(app)
      .get("/api/progress")
      .set(authorization)
      .expect(200);
    assert(
      progressResponse.body.categories.some(
        (category: any) =>
          category.id === favorite.id && Number(category.total) === 2,
      ),
    );

    await database("vocabulary_categories").where({ id: custom.id }).delete();
    const remainingWords = await database("vocabulary_words")
      .whereIn("id", wordIds)
      .count({ count: "id" })
      .first();
    assert.equal(Number(remainingWords?.count), 2);
    const linksAfterCategoryDelete = await database(
      "vocabulary_entry_categories",
    )
      .whereIn("word_id", wordIds)
      .where({ category_id: favorite.id })
      .count({ count: "word_id" })
      .first();
    assert.equal(Number(linksAfterCategoryDelete?.count), 2);

    console.log(
      JSON.stringify({
        status: "passed",
        defaultFavorite: "passed",
        additiveMultiCategory: "passed",
        duplicateRetry: "passed",
        atomicCreateAndAdd: "passed",
        allCategoriesVisibleAndAssignable: "passed",
        primaryCategoryPreserved: "passed",
        refreshPreservedPersonalLinks: "passed",
        accountIsolation: "passed",
        categoryBrowseReviewProgress: "passed",
        emptyCategoryCreationAndListing: "passed",
        taxonomyHierarchyApi: "passed",
        taxonomyLeafBrowseApi: "passed",
        categoryDeletePreservedWords: "passed",
      }),
    );
  } finally {
    await database("users").whereIn("id", [owner.id, otherUser.id]).delete();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedis();
    await database.destroy();
  });
