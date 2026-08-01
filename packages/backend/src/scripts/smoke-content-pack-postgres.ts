import assert from "assert";
import { randomUUID } from "crypto";
import { STARTER_SAMPLES } from "../data/starter-samples";
import { contentPackHash } from "../services/content-pack-contract";
import { ContentPackService } from "../services/content-pack.service";
import { database } from "../utils/db";

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const sample = STARTER_SAMPLES[0];
  const [owner] = await database("users")
    .insert({
      email: `content-pack-owner-${suffix}@example.invalid`,
      username: `pack-owner-${suffix}`,
      first_name: "Smoke",
      email_verified: true,
    })
    .returning("*");
  const [otherUser] = await database("users")
    .insert({
      email: `content-pack-other-${suffix}@example.invalid`,
      username: `pack-other-${suffix}`,
      first_name: "Isolation",
      email_verified: true,
    })
    .returning("*");

  const manifest: any = {
    formatVersion: "chatgpt-vocabulary-manifest-v1",
    manifestId: `postgres-smoke-${suffix}`,
    createdAt: new Date().toISOString(),
    source: {
      name: "PostgreSQL end-to-end smoke text",
      type: "text",
      contentHash: suffix.padEnd(64, "d"),
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
          candidateIds: ["candidate-001", "candidate-002"],
        },
      ],
    },
    candidates: [
      {
        candidateId: "candidate-001",
        term: sample.word,
        baseForm: sample.word,
        itemType: sample.itemType,
        decision: "generate",
        operation: "new",
        cefrLevel: sample.cefrLevel,
        usageFrequency: "heavy",
        fluencyValue: "essential",
        categoryName: sample.categoryName,
        contextualMeaning: sample.englishMeaning,
        occurrences: [
          {
            page: 1,
            chunkId: "chunk-001",
            sentence: sample.lesson.meaning_in_context.source_sentence,
          },
        ],
      },
      {
        candidateId: "candidate-002",
        term: "the",
        baseForm: "the",
        itemType: "word",
        decision: "filtered",
        reason: "Basic function word excluded from active vocabulary lessons.",
        occurrences: [
          {
            page: 1,
            chunkId: "chunk-001",
            sentence: "The smoke source includes a basic function word.",
          },
        ],
      },
    ],
    counts: {
      totalCandidates: 2,
      generate: 1,
      existing: 0,
      filtered: 1,
      rejected: 0,
      heavyUse: 1,
      mediumUse: 0,
    },
    generationPlan: {
      batchSize: 8,
      batches: [{ batchNumber: 1, candidateIds: ["candidate-001"] }],
    },
  };
  const batch = {
    formatVersion: "chatgpt-vocabulary-batch-v1",
    batchId: `${manifest.manifestId}-batch-001`,
    manifestId: manifest.manifestId,
    manifestHash: contentPackHash(manifest),
    batchNumber: 1,
    createdAt: new Date().toISOString(),
    entries: [
      {
        candidateId: "candidate-001",
        word: sample.word,
        pronunciation: sample.pronunciation,
        wordType: sample.wordType,
        englishMeaning: sample.englishMeaning,
        tamilMeaning: sample.tamilMeaning,
        coreIdea: sample.coreIdea,
        lesson: sample.lesson,
      },
    ],
  };
  const documents = [
    { path: "manifest.json", content: JSON.stringify(manifest) },
    { path: "batch-001.json", content: JSON.stringify(batch) },
  ];
  const service = new ContentPackService(database);

  try {
    const staged = await service.ingestDocuments(documents);
    assert.equal(staged.manifestsAdded, 1);
    assert.equal(staged.batchesAdded, 1);
    assert.deepEqual(staged.errors, []);

    await service.claimManifest(owner.id, manifest.manifestId);
    await assert.rejects(
      () => service.getManifest(otherUser.id, manifest.manifestId),
      /not found/i,
    );
    const completed = await service.approveManifest(
      owner.id,
      manifest.manifestId,
      ["candidate-001"],
    );
    assert.equal(completed.status, "completed");
    assert.equal(completed.generation.committedEntries, 1);

    const verification = await service.verifyManifest(
      owner.id,
      manifest.manifestId,
    );
    assert.deepEqual(verification, { verified: true, entries: 1, issues: [] });

    const replay = await service.ingestDocuments(documents);
    assert.equal(replay.unchanged, 2);
    assert.equal(replay.committedEntries, 0);
    const wordCount = await database("vocabulary_words")
      .where({ owner_user_id: owner.id })
      .count({ count: "id" })
      .first();
    assert.equal(Number(wordCount?.count), 1);

    console.log(
      JSON.stringify({
        status: "passed",
        manifestId: manifest.manifestId,
        committedEntries: 1,
        duplicateReplayCreated: 0,
        accountIsolation: "passed",
        postgresReadBack: "passed",
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
    await database.destroy();
  });
