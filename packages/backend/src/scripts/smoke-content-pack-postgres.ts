import assert from "assert";
import { randomUUID } from "crypto";
import { catalogueResolvedFixture, catalogueSupplementFixture } from "../services/catalogue-resolved.fixture";
import { cataloguePackFixture } from "../services/catalogue-pack.fixture";
import { catalogueDeliveryFixture } from "../services/catalogue-delivery.fixture";
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

  const [subsetOwner] = await database("users").insert({email:`subset-${suffix}@example.invalid`,username:`subset-${suffix}`,first_name:"Subset",email_verified:true}).returning('*');
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
      skippedItems: [],
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

    const catalogue = cataloguePackFixture();
    catalogue.manifest.manifestId = `catalogue-smoke-${suffix}`;
    catalogue.batch.manifestId = catalogue.manifest.manifestId;
    catalogue.batch.batchId = `catalogue-smoke-${suffix}-001`;
    catalogue.batch.manifestHash = contentPackHash(catalogue.manifest);
    const catalogueDocuments = [
      { path: "catalogue/manifest.json", content: JSON.stringify(catalogue.manifest) },
      { path: "catalogue/batch-001.json", content: JSON.stringify(catalogue.batch) },
    ];
    const catalogueStaged = await service.ingestDocuments(catalogueDocuments);
    assert.deepEqual(catalogueStaged.errors, []);
    await service.processAvailableManifests(owner.id);
    const catalogueVerified = await service.verifyManifest(owner.id, catalogue.manifest.manifestId);
    assert.deepEqual(catalogueVerified, { verified: true, entries: 3, issues: [] });
    const meanings = await database("vocabulary_words as word")
      .join("vocabulary_lessons as lesson", "lesson.word_id", "word.id")
      .where({ "word.owner_user_id": owner.id, "word.normalized_term": "charge" })
      .orderBy("word.sense_rank")
      .select("word.id", "word.sense_rank", "word.english_meaning", "lesson.lesson_data");
    assert.equal(meanings.length, 3);
    assert.deepEqual(meanings.map((word: any) => word.sense_rank), [1, 2, 3]);
    for (const [index, word] of meanings.entries()) {
      const lesson = typeof word.lesson_data === "string" ? JSON.parse(word.lesson_data) : word.lesson_data;
      assert.equal(lesson.meaning_in_context.example_origin, "authored_for_learning");
      assert.equal(lesson.meaning_in_context.contextual_meaning, catalogue.manifest.candidates[index].contextualMeaning);
    }
    await assert.rejects(() => service.getManifest(otherUser.id, catalogue.manifest.manifestId), /not found/i);
    await database("user_progress").where({ user_id: owner.id, word_id: meanings[0].id }).update({ times_reviewed: 7, proficiency_level: 3 });
    const beforeReplayProgress = await database("user_progress").where({ user_id: owner.id, word_id: meanings[0].id }).first();
    assert(beforeReplayProgress, "catalogue import must create review progress");
    const catalogueReplay = await service.ingestDocuments(catalogueDocuments);
    assert.equal(catalogueReplay.unchanged, 2);
    assert.equal(catalogueReplay.committedEntries, 0);
    const afterReplayProgress = await database("user_progress").where({ user_id: owner.id, word_id: meanings[0].id }).first();
    assert.equal(afterReplayProgress.times_reviewed, 7);
    assert.equal(afterReplayProgress.proficiency_level, 3);
    const replayMeanings = await database("vocabulary_words").where({ owner_user_id: owner.id, normalized_term: "charge" }).orderBy("sense_rank").select("id");
    assert.deepEqual(replayMeanings.map((word: any) => word.id), meanings.map((word: any) => word.id));

    // Synthetic group integration: actual PostgreSQL concurrency, receipts,
    // unchanged existing senses/progress, and original source-segment order.
    const grouped = catalogueDeliveryFixture(otherUser.id);
    grouped.manifest.manifestId = `catalogue-group-${suffix}-1`;
    grouped.batch.manifestId = grouped.manifest.manifestId;
    grouped.batch.batchId = `${grouped.manifest.manifestId}-001`;
    grouped.batch.manifestHash = contentPackHash(grouped.manifest);
    const competing = JSON.parse(JSON.stringify(grouped));
    competing.manifest.manifestId = `catalogue-group-${suffix}-competing`;
    competing.batch.manifestId = competing.manifest.manifestId;
    competing.batch.batchId = `${competing.manifest.manifestId}-001`;
    competing.batch.manifestHash = contentPackHash(competing.manifest);
    const groupDocs = [grouped, competing].flatMap(pack => [
      {path: `${pack.manifest.manifestId}/manifest.json`, content: JSON.stringify(pack.manifest)},
      {path: `${pack.manifest.manifestId}/batch-001.json`, content: JSON.stringify(pack.batch)},
    ]);
    assert.deepEqual((await service.ingestDocuments(groupDocs)).errors, []);
    await assert.rejects(() => service.claimManifest(owner.id, grouped.manifest.manifestId), /another account/);
    const claims = await Promise.allSettled([grouped, competing].map(pack => service.claimManifest(otherUser.id, pack.manifest.manifestId)));
    assert.equal(claims.filter(result => result.status === 'fulfilled').length, 1, 'only one competing group manifest may claim the source window');
    const winner = [grouped, competing][claims.findIndex(result => result.status === 'fulfilled')];
    assert.deepEqual(await service.verifyManifest(otherUser.id, winner.manifest.manifestId), {verified: true, entries: 3, issues: []});
    const importedGroupWords = await database('vocabulary_words').where({owner_user_id: otherUser.id, normalized_term: 'charge'}).orderBy('sense_rank');
    assert.equal(importedGroupWords.length, 3);
    await database('user_progress').where({user_id: otherUser.id, word_id: importedGroupWords[0].id}).update({times_reviewed: 9});

    const second = catalogueDeliveryFixture(otherUser.id, 2);
    second.manifest.manifestId = `catalogue-group-${suffix}-2`;
    second.manifest.catalogueAudit.deliveryGroup.previousGroup = {manifestId: winner.manifest.manifestId, manifestHash: contentPackHash(winner.manifest)};
    second.batch.manifestId = second.manifest.manifestId;
    second.batch.batchId = `${second.manifest.manifestId}-001`;
    second.batch.manifestHash = contentPackHash(second.manifest);
    const secondDocuments = [
      {path: 'group-two/manifest.json', content: JSON.stringify(second.manifest)},
      {path: 'group-two/batch-001.json', content: JSON.stringify(second.batch)},
    ];
    assert.deepEqual((await service.ingestDocuments(secondDocuments)).errors, []);
    await service.claimManifest(otherUser.id, second.manifest.manifestId);
    assert.deepEqual(await service.verifyManifest(otherUser.id, second.manifest.manifestId), {verified: true, entries: 3, issues: []});
    assert.equal((await service.ingestDocuments(secondDocuments)).unchanged, 2);
    await service.claimManifest(otherUser.id, second.manifest.manifestId);
    const reuseEvents = await database('control_audit_events').where({owner_user_id: otherUser.id, event_type: 'content_pack.entry_reused'});
    assert.equal(reuseEvents.length, 3, 'offline duplicate senses are reused, never overwritten');
    const afterGroups = await database('vocabulary_words').where({owner_user_id: otherUser.id, normalized_term: 'charge'}).orderBy('sense_rank');
    assert.deepEqual(afterGroups.map((word: any) => [word.id, word.entry_version]), importedGroupWords.map((word: any) => [word.id, word.entry_version]));
    assert.equal((await database('user_progress').where({user_id: otherUser.id, word_id: importedGroupWords[0].id}).first()).times_reviewed, 9);
    const firstGroupRow = await database('content_pack_manifests').where({id: winner.manifest.manifestId}).first();
    const groupSegments = await database('source_segments').where({source_id: firstGroupRow.source_id}).orderBy('sequence_number');
    assert.deepEqual(groupSegments.map((row: any) => row.sequence_number), Array.from({length: 12}, (_, i) => i + 1));
    const finalLocator = typeof groupSegments[11].locator === 'string' ? JSON.parse(groupSegments[11].locator) : groupSegments[11].locator;
    assert.equal(finalLocator.chunkId, 'group-00012');

    // Resolved bases and late supplements use actual PostgreSQL transactions.
    const ready = catalogueResolvedFixture(subsetOwner.id);
    const future = catalogueResolvedFixture(subsetOwner.id, 2);
    future.manifest.catalogueAudit.resolvedDelivery.previousBase = {manifestId:ready.manifest.manifestId,manifestHash:contentPackHash(ready.manifest)};
    const late = catalogueSupplementFixture(ready);
    const docs = (pack: any) => [{path:`${pack.manifest.manifestId}/manifest.json`,content:JSON.stringify(pack.manifest)},
      ...(pack.manifest.counts.generate ? [{path:`${pack.manifest.manifestId}/batch-001.json`,content:JSON.stringify(pack.batch)}] : [])];
    assert.deepEqual((await service.ingestDocuments(docs(future))).errors, []);
    await assert.rejects(()=>service.claimManifest(subsetOwner.id,future.manifest.manifestId),/pending/);
    assert.deepEqual((await service.ingestDocuments(docs(ready))).errors, []);
    await assert.rejects(()=>service.claimManifest(owner.id,ready.manifest.manifestId),/another account/);
    await Promise.all([service.claimManifest(subsetOwner.id,ready.manifest.manifestId),service.claimManifest(subsetOwner.id,ready.manifest.manifestId)]);
    assert.deepEqual(await service.verifyManifest(subsetOwner.id,ready.manifest.manifestId),{verified:true,entries:2,issues:[]});
    const beforeSubset=await database('vocabulary_words').where({owner_user_id:subsetOwner.id}).orderBy('sense_rank');
    assert.equal(beforeSubset.length,2);
    await database('user_progress').where({user_id:subsetOwner.id,word_id:beforeSubset[0].id}).update({times_reviewed:17});
    await database('content_pack_manifests').where({id:ready.manifest.manifestId}).update({last_verified_at:null,verification_report:JSON.stringify({verified:false,entries:2,issues:['Synthetic interrupted read-back']})});
    await database('content_pack_batches').where({manifest_id:ready.manifest.manifestId}).update({readback_verified_at:null});
    await assert.rejects(()=>service.markInboxCleaned(ready.manifest.manifestId,'fixture-cleanup'),/verification/);
    await assert.rejects(()=>service.claimManifest(subsetOwner.id,future.manifest.manifestId),/pending/);
    await (service as any).commitAvailableBatches(subsetOwner.id,ready.manifest.manifestId);
    assert.deepEqual(await service.verifyManifest(subsetOwner.id,ready.manifest.manifestId),{verified:true,entries:2,issues:[]});
    await service.markInboxCleaned(ready.manifest.manifestId,'fixture-cleanup');
    assert.equal((await database('content_pack_manifests').where({id:future.manifest.manifestId}).first()).inbox_cleaned_at,null);
    await service.claimManifest(subsetOwner.id,future.manifest.manifestId);
    assert.deepEqual(await service.verifyManifest(subsetOwner.id,future.manifest.manifestId),{verified:true,entries:0,issues:[]});
    assert.deepEqual((await service.ingestDocuments(docs(late))).errors, []);
    await service.claimManifest(subsetOwner.id,late.manifest.manifestId);
    assert.deepEqual(await service.verifyManifest(subsetOwner.id,late.manifest.manifestId),{verified:true,entries:1,issues:[]});
    assert.equal((await database('vocabulary_words').where({owner_user_id:subsetOwner.id})).length,3);
    assert.equal((await database('user_progress').where({user_id:subsetOwner.id,word_id:beforeSubset[0].id}).first()).times_reviewed,17);
    assert.equal((await service.ingestDocuments(docs(late))).unchanged,2);
    await service.claimManifest(subsetOwner.id,late.manifest.manifestId);
    assert.deepEqual(await service.verifyManifest(subsetOwner.id,late.manifest.manifestId),{verified:true,entries:1,issues:[]});
    assert.equal((await database('vocabulary_words').where({owner_user_id:subsetOwner.id})).length,3);

    console.log(
      JSON.stringify({
        status: "passed",
        manifestId: manifest.manifestId,
        committedEntries: 1,
        duplicateReplayCreated: 0,
        accountIsolation: "passed",
        postgresReadBack: "passed",
        threeLevelTaxonomyReadBack: "passed",
        catalogueMeanings: 3,
        resolvedDeliveryAndLateSupplement: "passed",
        authoredExampleReadBack: "passed",
        catalogueGroupConcurrency: "passed",
        catalogueGroupReadBack: "passed",
        catalogueGroupProgressPreservation: "passed",
      }),
    );
  } finally {
    await database("users").whereIn("id", [owner.id, otherUser.id, subsetOwner.id]).delete();
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


