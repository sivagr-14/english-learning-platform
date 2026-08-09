import assert from "assert";
import { randomUUID } from "crypto";
import { STARTER_SAMPLES } from "../data/starter-samples";
import { contentPackHash } from "../services/content-pack-contract";
import { ContentPackService } from "../services/content-pack.service";
import { database } from "../utils/db";
import { closeRedis } from "../utils/redis";

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
    formatVersion: "chatgpt-vocabulary-manifest-v4",
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
        senseDecision: "new_sense",
        senseKey: "clear-and-uncomplicated",
        cefrLevel: sample.cefrLevel,
        usageFrequency: "heavy",
        fluencyValue: "essential",
        categoryName: "Starting and finishing",
        taxonomy: {
          taxonomyVersion: "2026.1",
          domainKey: "everyday_life",
          usageGroupKey: "everyday_life.practical_actions",
          categoryKey: "everyday_life.practical_actions.starting_and_finishing",
          confidence: "high",
        },
        contextualMeaning: sample.lesson.meaning_in_context.contextual_meaning,
        senseEvidence: {
          sentence: sample.lesson.meaning_in_context.source_sentence,
          explanation:
            "The source uses the adjective for a clear and uncomplicated process.",
        },
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
        senseDecision: "new_sense",
        senseKey: "basic-function-word",
        contextualMeaning: "A grammatical article in the source sentence.",
        senseEvidence: {
          sentence: "The smoke source includes a basic function word.",
          explanation:
            "The occurrence is a grammatical article rather than useful vocabulary.",
        },
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
    inventoryAudit: {
      items: [
        {
          inventoryId: "inventory-candidate-001",
          kind: "token",
          surfaceForm: sample.word,
          normalizedForm: sample.word.toLowerCase(),
          chunkId: "chunk-001",
          sentence: sample.lesson.meaning_in_context.source_sentence,
          disposition: "candidate",
          candidateId: "candidate-001",
        },
        {
          inventoryId: "inventory-candidate-002",
          kind: "token",
          surfaceForm: "the",
          normalizedForm: "the",
          chunkId: "chunk-001",
          sentence: "The smoke source includes a basic function word.",
          disposition: "candidate",
          candidateId: "candidate-002",
        },
      ],
      counts: { total: 2, candidateLinked: 2, excluded: 0, untracked: 0 },
      recallPass: {
        completed: true,
        unresolvedInventoryIds: [],
        missedFindings: [],
      },
    },
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
    formatVersion: "chatgpt-vocabulary-batch-v4",
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
        englishMeaning: sample.lesson.meaning_in_context.contextual_meaning,
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
    const fetchedCommit = "a".repeat(40);
    const staged = await service.ingestDocuments(documents, {
      inboxBranch: "chatgpt-content-inbox",
      fetchedCommit,
    });
    assert.equal(staged.manifestsAdded, 1);
    assert.equal(staged.batchesAdded, 1);
    assert.deepEqual(staged.errors, []);

    const stagedRow = await database("content_pack_manifests")
      .where({ id: manifest.manifestId })
      .first();
    assert.equal(stagedRow.inbox_branch, "chatgpt-content-inbox");
    assert.equal(stagedRow.fetched_commit, fetchedCommit);

    const processed = await service.processAvailableManifests(owner.id);
    assert.deepEqual(processed, {
      processed: [manifest.manifestId],
      cleanupEligible: [manifest.manifestId],
      failures: [],
      blockedByAccount: [],
    });
    await assert.rejects(
      () => service.getManifest(otherUser.id, manifest.manifestId),
      /not found/i,
    );
    const completed = await service.getManifest(owner.id, manifest.manifestId);
    assert.equal(completed.status, "completed");
    assert.equal(completed.generation.committedEntries, 1);

    const verification = await service.verifyManifest(
      owner.id,
      manifest.manifestId,
    );
    assert.deepEqual(verification, { verified: true, entries: 1, issues: [] });

    const replay = await service.ingestDocuments(documents, {
      inboxBranch: "chatgpt-content-inbox",
      fetchedCommit,
    });
    assert.equal(replay.unchanged, 2);
    assert.equal(replay.committedEntries, 0);
    const wordCount = await database("vocabulary_words")
      .where({ owner_user_id: owner.id })
      .count({ count: "id" })
      .first();
    assert.equal(Number(wordCount?.count), 1);
    const taxonomyReadBack = await database("vocabulary_words as word")
      .join(
        "vocabulary_taxonomy_categories as category",
        "category.category_key",
        "word.taxonomy_category_key",
      )
      .join(
        "vocabulary_taxonomy_usage_groups as usage_group",
        "usage_group.usage_group_key",
        "category.usage_group_key",
      )
      .join(
        "vocabulary_taxonomy_domains as domain",
        "domain.domain_key",
        "category.domain_key",
      )
      .where("word.owner_user_id", owner.id)
      .select(
        "domain.domain_key",
        "usage_group.usage_group_key",
        "category.category_key",
        "word.taxonomy_assignment_source",
      )
      .first();
    assert.deepEqual(taxonomyReadBack, {
      domain_key: "everyday_life",
      usage_group_key: "everyday_life.practical_actions",
      category_key: "everyday_life.practical_actions.starting_and_finishing",
      taxonomy_assignment_source: "content-pack-v3",
    });

    console.log(
      JSON.stringify({
        status: "passed",
        manifestId: manifest.manifestId,
        committedEntries: 1,
        duplicateReplayCreated: 0,
        accountIsolation: "passed",
        postgresReadBack: "passed",
        threeLevelTaxonomyReadBack: "passed",
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
