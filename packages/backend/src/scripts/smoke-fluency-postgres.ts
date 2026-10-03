import assert from "assert";
import { randomUUID } from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { database } from "../utils/db";
import fluency from "../routes/fluency";
import flashcards from "../routes/flashcards";
import collections from "../routes/fluency-collections";
import { createCollectionPlan } from "../services/collection-plan";
import { contentPackHash } from "../services/content-pack-contract";
import vocabulary from "../routes/vocabulary";
import { errorHandler } from "../middleware/error.middleware";
import { STARTER_SAMPLES } from "../data/starter-samples";

export async function smokeFluency() {
  const userId = randomUUID();
  const outsider = randomUUID();
  const categoryId = randomUUID();
  const wordId = randomUUID();
  const otherId = randomUUID();
  const privateId = randomUUID();
  process.env.JWT_SECRET ||= "isolated-fluency-smoke-secret";
  const token = jwt.sign({ userId }, process.env.JWT_SECRET);
  const app = express();
  app.use(express.json());
  app.use("/collections", collections);
  app.use("/fluency", fluency);
  app.use("/flashcards", flashcards);
  app.use("/vocabulary", vocabulary);
  app.use(errorHandler);
  const get = (url: string) =>
    request(app).get(url).set("Authorization", `Bearer ${token}`);
  const post = (url: string, data: any) =>
    request(app).post(url).set("Authorization", `Bearer ${token}`).send(data);
  try {
    await database("users").insert([
      { id: userId, email: `${userId}@smoke.invalid` },
      { id: outsider, email: `${outsider}@smoke.invalid` },
    ]);
    await database("vocabulary_categories").insert({
      id: categoryId,
      owner_user_id: userId,
      track_number: 1,
      track_name: "Fluency smoke",
      category_number: 1,
      category_name: "Fluency smoke",
    });
    const sample = STARTER_SAMPLES[0];
    await database("vocabulary_words").insert([
      {
        id: wordId,
        owner_user_id: userId,
        category_id: categoryId,
        word: sample.word,
        normalized_term: sample.word.toLowerCase(),
        sense_rank: 1,
        sense_key: "smoke-primary",
        english_meaning: sample.englishMeaning,
        tamil_meaning: sample.tamilMeaning,
        core_idea: sample.coreIdea,
        cefr_level: "B2",
      },
      {
        id: otherId,
        owner_user_id: userId,
        category_id: categoryId,
        word: sample.word,
        normalized_term: sample.word.toLowerCase(),
        sense_rank: 2,
        sense_key: "smoke-secondary",
        english_meaning: "A distinct test-fixture meaning.",
        cefr_level: "B2",
      },
      {
        id: privateId,
        owner_user_id: outsider,
        category_id: categoryId,
        word: sample.word,
        normalized_term: sample.word.toLowerCase(),
        sense_rank: 1,
        sense_key: "private-sense",
        english_meaning: "Private test-fixture meaning.",
        cefr_level: "B2",
      },
    ]);
    await database("vocabulary_lessons").insert({
      word_id: wordId,
      lesson_data: sample.lesson,
    });
    assert.equal((await request(app).get("/fluency/coverage")).status, 401);
    const coverage = await get("/fluency/coverage");
    assert.equal(coverage.status, 200);
    assert.equal(coverage.body.categories.length, 500);
    assert.equal(coverage.body.totalEntries, 2);
    const senses = await get(`/vocabulary/words/${wordId}`);
    assert.equal(senses.status, 200);
    assert.equal(senses.body.otherMeanings.length, 1);
    assert.equal(senses.body.otherMeanings[0].id, otherId);
    const attempt = {
      id: randomUUID(),
      word_id: wordId,
      skill: "speaking",
      successful: true,
      answer: "A complete test response.",
      reflection: "",
      context: "work",
      phase: "practice",
    };
    assert.equal(
      (await post("/fluency/attempts", { ...attempt, word_id: privateId }))
        .status,
      404,
    );
    assert.equal((await post("/fluency/attempts", attempt)).status, 200);
    assert.equal(
      (await post("/fluency/attempts", attempt)).body.replayed,
      true,
    );
    assert.equal(
      (
        await post("/fluency/attempts", {
          ...attempt,
          answer: "A conflicting response.",
        })
      ).status,
      409,
    );
    const state = await database("fluency_skill_progress")
      .where({ user_id: userId, word_id: wordId, skill: "speaking" })
      .first();
    assert.equal(state.state.attempts, 1);
    assert.equal(state.state.stage, "recognised");
    assert.equal(
      await database("fluency_skill_progress")
        .where({ user_id: userId, word_id: otherId })
        .first(),
      undefined,
    );
    const practice = await get(`/fluency/practice?wordId=${wordId}`);
    assert.equal(practice.status, 200);
    assert.equal(practice.body.cards[0].id, wordId);
    const audit = await get("/fluency/audit");
    assert.equal(audit.status, 200);
    assert.equal(audit.body.items.length, 2);
    const manifestId = `smoke-${randomUUID()}`;
    const candidate = {
      candidateId: "candidate-001",
      term: sample.word,
      baseForm: sample.word,
      itemType: sample.itemType,
      decision: "generate",
      operation: "new",
      senseDecision: "new_sense",
      senseKey: "smoke-primary",
      cefrLevel: sample.cefrLevel,
      usageFrequency: "heavy",
      fluencyValue: "essential",
      categoryName: sample.categoryName,
      contextualMeaning: sample.englishMeaning,
      senseEvidence: {
        sentence: sample.lesson.meaning_in_context.source_sentence,
        explanation:
          "A synthetic test receipt linked to the starter lesson's evidenced meaning.",
      },
      occurrences: [
        {
          page: 1,
          chunkId: "chunk-001",
          sentence: sample.lesson.meaning_in_context.source_sentence,
        },
      ],
    };
    const manifest = {
      formatVersion: "chatgpt-vocabulary-manifest-v2",
      manifestId,
      createdAt: "2026-10-03T12:00:00Z",
      source: {
        name: "Isolated fixture",
        type: "text",
        contentHash: "a".repeat(64),
        totalPages: 1,
        totalChunks: 1,
      },
      coverage: {
        pages: [{ page: 1, status: "assessed", chunkIds: ["chunk-001"] }],
        chunks: [
          {
            chunkId: "chunk-001",
            pageStart: 1,
            pageEnd: 1,
            status: "assessed",
            candidateIds: [candidate.candidateId],
          },
        ],
      },
      candidates: [candidate],
      counts: {
        totalCandidates: 1,
        generate: 1,
        existing: 0,
        filtered: 0,
        rejected: 0,
        heavyUse: 1,
        mediumUse: 0,
      },
      generationPlan: {
        batchSize: 100,
        batches: [{ batchNumber: 1, candidateIds: [candidate.candidateId] }],
      },
    };
    const plan = createCollectionPlan(`collection-${randomUUID()}`, [manifest]);
    const manifestHash = plan.packs[0].units[0].manifestHash;
    await database("content_pack_manifests").insert({
      id: manifestId,
      owner_user_id: userId,
      manifest_hash: manifestHash,
      source_name: "Isolated fixture",
      source_type: "text",
      status: "completed",
      counts: manifest.counts,
      payload: manifest,
      verification_report: { verified: true },
    });
    assert.equal((await post("/collections", plan)).status, 200);
    assert.equal((await post("/collections", plan)).status, 200);
    assert.equal(
      (await post("/collections", { ...plan, entryCount: 2 })).status,
      422,
    );
    assert.equal(
      (await get("/collections")).body.collections[0].packs[0].complete,
      false,
    );
    await database("content_pack_batches").insert({
      id: `${manifestId}-batch-001`,
      manifest_id: manifestId,
      batch_number: 1,
      content_hash: contentPackHash({ fixture: true }),
      manifest_hash: manifestHash,
      status: "committed",
      entry_count: 1,
      committed_count: 1,
      payload: {},
      // pg serializes bare arrays as PostgreSQL arrays, not JSON.
      committed_word_ids: JSON.stringify([wordId]),
    });
    const committedBatch = await database("content_pack_batches")
      .where({ id: `${manifestId}-batch-001` })
      .first();
    assert.deepEqual(committedBatch.committed_word_ids, [wordId]);
    const review = {
      manifestId,
      manifestHash,
      batchNumber: 1,
      reviewer: "Isolated fixture reviewer",
      candidates: [
        {
          candidateId: candidate.candidateId,
          frequencyEvidence:
            "Synthetic test evidence only; not a real corpus assertion.",
          languageTeachingReview:
            "Synthetic test review of the lesson; never published as learner content.",
        },
      ],
    };
    assert.equal(
      (await post(`/collections/${plan.collectionId}/reviews`, review)).status,
      200,
    );
    assert.equal(
      (await get("/collections")).body.collections[0].packs[0].complete,
      true,
    );
    // Exercise SQL-backed queue creation at the actual target collection size.
    const scale = Number(process.env.FLUENCY_SMOKE_ENTRIES || 40000);
    for (let offset = 0; offset < scale; offset += 500) {
      await database("vocabulary_words").insert(
        Array.from({ length: Math.min(500, scale - offset) }, (_, n) => ({
          owner_user_id: userId,
          category_id: categoryId,
          word: `fixture-${offset + n}`,
          normalized_term: `fixture-${offset + n}`,
          sense_key: "fixture-sense",
        })),
      );
    }
    const due = await get("/flashcards/due");
    assert.equal(due.status, 200);
    assert(due.body.cards.length <= 10);
    const queued = await database("flashcard_queue")
      .where({ user_id: userId })
      .count({ count: "*" })
      .first();
    assert.equal(Number(queued?.count), scale + 2);
    const id = due.body.cards[0].id;
    const reviewId = randomUUID();
    assert.equal(
      (
        await post(`/flashcards/${id}/review`, {
          rating: "easy",
          requestId: reviewId,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await post(`/flashcards/${id}/review`, {
          rating: "easy",
          requestId: reviewId,
        })
      ).status,
      200,
    );
    const progress = await database("user_progress")
      .where({ user_id: userId, word_id: id })
      .first();
    assert.equal(progress.times_reviewed, 1);
    assert.equal(progress.status, "in_progress");
    const queue = await database("flashcard_queue")
      .where({ user_id: userId, word_id: id })
      .first();
    assert.equal(
      new Date(queue.due_at).getTime(),
      new Date(progress.next_review_at).getTime(),
    );
    assert.equal((await get("/flashcards/due?limit=-1")).status, 400);
    console.log(
      JSON.stringify({
        fluencySmoke: "passed",
        catalogue: 500,
        scaleEntries: scale,
        checks: [
          "ownership",
          "sense-isolation",
          "idempotency",
          "review-schedule",
          "coverage",
          "audit",
          "bounded-queue",
        ],
      }),
    );
  } finally {
    await database("users").whereIn("id", [userId, outsider]).delete();
    await database("vocabulary_categories").where({ id: categoryId }).delete();
  }
}
if (require.main === module)
  smokeFluency()
    .then(() => database.destroy())
    .catch(async (error) => {
      console.error(error);
      await database.destroy();
      process.exitCode = 1;
    });
