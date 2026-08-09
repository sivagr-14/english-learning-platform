import { STARTER_SAMPLES } from "../data/starter-samples";
import {
  contentPackHash,
  validateContentBatch,
  validateContentManifest,
} from "./content-pack-contract";

function validManifest(): any {
  const sample = STARTER_SAMPLES[0];
  return {
    formatVersion: "chatgpt-vocabulary-manifest-v1",
    manifestId: "smoke-import-001",
    createdAt: "2026-08-01T12:00:00.000Z",
    source: {
      name: "Smoke test text",
      type: "text",
      contentHash: "a".repeat(64),
      totalPages: 2,
      totalChunks: 2,
    },
    coverage: {
      pages: [
        { page: 1, status: "assessed", chunkIds: ["chunk-001"] },
        { page: 2, status: "assessed", chunkIds: ["chunk-002"] },
      ],
      chunks: [
        {
          chunkId: "chunk-001",
          pageStart: 1,
          pageEnd: 1,
          status: "assessed",
          candidateIds: ["candidate-001"],
        },
        {
          chunkId: "chunk-002",
          pageStart: 2,
          pageEnd: 2,
          status: "assessed",
          candidateIds: ["candidate-002"],
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
        reason: "Basic function word that does not need a separate lesson.",
        occurrences: [
          {
            page: 2,
            chunkId: "chunk-002",
            sentence: "The source sentence contains a basic function word.",
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
}

function validBatch(manifest: ReturnType<typeof validManifest>): any {
  const sample = STARTER_SAMPLES[0];
  return {
    formatVersion: "chatgpt-vocabulary-batch-v1",
    batchId: "smoke-import-001-batch-001",
    manifestId: manifest.manifestId,
    manifestHash: contentPackHash(manifest),
    batchNumber: 1,
    createdAt: "2026-08-01T12:05:00.000Z",
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
}

function validSenseAwarePack(): { manifest: any; batch: any } {
  const sample = STARTER_SAMPLES[0];
  const contextualMeaning = sample.lesson.meaning_in_context.contextual_meaning;
  const sourceSentence = sample.lesson.meaning_in_context.source_sentence;
  const manifest = validManifest();
  manifest.formatVersion = "chatgpt-vocabulary-manifest-v2";
  manifest.candidates[0] = {
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
    categoryName: sample.categoryName,
    contextualMeaning,
    senseEvidence: {
      sentence: sourceSentence,
      explanation:
        "The adjective describes a process that is clear and uncomplicated.",
    },
    occurrences: [{ page: 1, chunkId: "chunk-001", sentence: sourceSentence }],
  };
  manifest.candidates[1] = {
    ...manifest.candidates[1],
    senseDecision: "ambiguous",
    senseKey: "basic-function-word",
    contextualMeaning: "A grammatical article in the source sentence.",
    senseEvidence: {
      sentence: manifest.candidates[1].occurrences[0].sentence,
      explanation:
        "The occurrence is a grammatical article rather than useful vocabulary.",
    },
  };
  const batch = validBatch(manifest);
  batch.formatVersion = "chatgpt-vocabulary-batch-v2";
  batch.manifestHash = contentPackHash(manifest);
  batch.entries[0].englishMeaning = contextualMeaning;
  return { manifest, batch };
}

function validTaxonomyAwarePack(): { manifest: any; batch: any } {
  const { manifest, batch } = validSenseAwarePack();
  manifest.formatVersion = "chatgpt-vocabulary-manifest-v3";
  manifest.candidates[0].categoryName = "Practice and improvement";
  manifest.candidates[0].taxonomy = {
    taxonomyVersion: "2026.1",
    domainKey: "education",
    usageGroupKey: "education.study_skills",
    categoryKey: "education.study_skills.practice_and_improvement",
    confidence: "high",
  };
  batch.formatVersion = "chatgpt-vocabulary-batch-v3";
  batch.manifestHash = contentPackHash(manifest);
  return { manifest, batch };
}

function validExhaustivePack(): { manifest: any; batch: any } {
  const { manifest, batch } = validTaxonomyAwarePack();
  manifest.formatVersion = "chatgpt-vocabulary-manifest-v4";
  manifest.inventoryAudit = {
    items: manifest.candidates.map((candidate: any, index: number) => ({
      inventoryId: `inventory-${index + 1}`,
      kind: "token",
      surfaceForm: candidate.term,
      normalizedForm: candidate.baseForm,
      chunkId: candidate.occurrences[0].chunkId,
      sentence: candidate.occurrences[0].sentence,
      disposition: "candidate",
      candidateId: candidate.candidateId,
    })),
    counts: { total: 2, candidateLinked: 2, excluded: 0, untracked: 0 },
    recallPass: { completed: true, unresolvedInventoryIds: [], missedFindings: [] },
  };
  batch.formatVersion = "chatgpt-vocabulary-batch-v4";
  batch.manifestHash = contentPackHash(manifest);
  return { manifest, batch };
}

describe("ChatGPT content-pack contract", () => {
  it("accepts a fully reconciled manifest and its exact lesson batch", () => {
    const manifest = validManifest();
    const manifestResult = validateContentManifest(manifest);
    expect(manifestResult.valid).toBe(true);
    expect(manifestResult.issues).toEqual([]);
    expect(validateContentBatch(validBatch(manifest), manifest).valid).toBe(
      true,
    );
  });

  it("rejects missing page coverage and incorrect declared counts", () => {
    const manifest = validManifest();
    manifest.coverage.pages.pop();
    manifest.counts.generate = 2;
    const result = validateContentManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/every page exactly once/i);
    expect(result.issues.join(" ")).toMatch(/declared totals/i);
  });

  it("rejects generation plans that omit or duplicate candidates", () => {
    const manifest = validManifest();
    manifest.generationPlan.batches[0].candidateIds = [
      "candidate-001",
      "candidate-001",
    ];
    const result = validateContentManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/multiple batches|exactly once/i);
  });

  it("rejects inconsistent page, chunk and occurrence cross-ledgers", () => {
    const manifest = validManifest();
    manifest.coverage.pages[1].chunkIds = ["chunk-001"];
    manifest.candidates[1].occurrences[0] = {
      page: 1,
      chunkId: "chunk-002",
      sentence: "The source sentence contains a basic function word.",
    };
    const result = validateContentManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/chunk IDs may appear only once/i);
    expect(result.issues.join(" ")).toMatch(/every chunk must be assigned/i);
    expect(result.issues.join(" ")).toMatch(/outside chunk .* page range/i);
  });

  it("rejects a batch that does not match the immutable manifest", () => {
    const manifest = validManifest();
    const batch = validBatch(manifest);
    batch.manifestHash = "b".repeat(64);
    batch.entries[0].word = "different term";
    const result = validateContentBatch(batch, manifest);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/manifestHash/i);
    expect(result.issues.join(" ")).toMatch(/assessed term/i);
  });

  it("accepts manifest v2 and an exact contextual lesson", () => {
    const { manifest, batch } = validSenseAwarePack();
    expect(validateContentManifest(manifest)).toMatchObject({
      valid: true,
      issues: [],
    });
    expect(validateContentBatch(batch, manifest)).toMatchObject({
      valid: true,
      issues: [],
    });
  });

  it("accepts v3 only when every generated sense has one valid three-level path", () => {
    const { manifest, batch } = validTaxonomyAwarePack();
    expect(validateContentManifest(manifest)).toMatchObject({
      valid: true,
      issues: [],
    });
    expect(validateContentBatch(batch, manifest)).toMatchObject({
      valid: true,
      issues: [],
    });
  });

  it("rejects missing, mismatched and invented v3 taxonomy paths", () => {
    const missing = validTaxonomyAwarePack();
    delete missing.manifest.candidates[0].taxonomy;
    expect(validateContentManifest(missing.manifest).issues.join(" ")).toMatch(
      /require domain, usage group and specific category/i,
    );

    const mismatched = validTaxonomyAwarePack();
    mismatched.manifest.candidates[0].taxonomy.domainKey = "work";
    expect(
      validateContentManifest(mismatched.manifest).issues.join(" "),
    ).toMatch(/controlled taxonomy path|valid controlled path/i);

    const invented = validTaxonomyAwarePack();
    invented.manifest.candidates[0].taxonomy.categoryKey =
      "education.study_skills.invented_category";
    expect(validateContentManifest(invented.manifest).valid).toBe(false);
  });

  it("keeps immutable v3 packs valid without retroactive inventory fields", () => {
    const { manifest } = validTaxonomyAwarePack();
    delete manifest.inventoryAudit;
    expect(validateContentManifest(manifest).valid).toBe(true);
  });

  it("rejects v4 manifests without exhaustive inventory proof", () => {
    const { manifest } = validExhaustivePack();
    delete manifest.inventoryAudit;
    expect(validateContentManifest(manifest).valid).toBe(false);
  });

  it("rejects unlinked inventory and candidates", () => {
    const { manifest } = validExhaustivePack();
    manifest.inventoryAudit.items[0].candidateId = "unknown-candidate";
    expect(validateContentManifest(manifest).issues.join(" ")).toMatch(/unknown candidate|no deterministic inventory link/i);
  });

  it("allows one spelling to have different sense keys", () => {
    const { manifest } = validSenseAwarePack();
    const original = manifest.candidates[0];
    manifest.candidates.push({
      ...original,
      candidateId: "candidate-003",
      senseKey: "honest-and-direct-person",
      contextualMeaning:
        "A person who communicates honestly and directly without hiding the point.",
      senseEvidence: {
        sentence: "She was straightforward about the problem.",
        explanation:
          "Straightforward describes her direct and honest communication.",
      },
      occurrences: [
        {
          page: 2,
          chunkId: "chunk-002",
          sentence: "She was straightforward about the problem.",
        },
      ],
    });
    manifest.coverage.chunks[1].candidateIds.push("candidate-003");
    manifest.counts.totalCandidates += 1;
    manifest.counts.generate += 1;
    manifest.counts.heavyUse += 1;
    manifest.generationPlan.batches[0].candidateIds.push("candidate-003");

    expect(validateContentManifest(manifest).valid).toBe(true);
  });

  it("rejects duplicate term-and-sense candidates and visible suffixes", () => {
    const { manifest } = validSenseAwarePack();
    const duplicate = {
      ...manifest.candidates[0],
      candidateId: "candidate-duplicate",
    };
    manifest.candidates.push(duplicate);
    manifest.coverage.chunks[0].candidateIds.push(duplicate.candidateId);
    manifest.counts.totalCandidates += 1;
    manifest.counts.generate += 1;
    manifest.counts.heavyUse += 1;
    manifest.generationPlan.batches[0].candidateIds.push(duplicate.candidateId);
    expect(validateContentManifest(manifest).issues.join(" ")).toMatch(
      /term and contextual sense/i,
    );

    const clean = validSenseAwarePack();
    clean.batch.entries[0].word = `${clean.batch.entries[0].word} (B)`;
    expect(
      validateContentBatch(clean.batch, clean.manifest).issues.join(" "),
    ).toMatch(/real unsuffixed term/i);
  });

  it("rejects a v2 batch that teaches a meaning not assessed in context", () => {
    const { manifest, batch } = validSenseAwarePack();
    batch.entries[0].englishMeaning =
      "An unrelated dictionary meaning not demonstrated by the source.";
    expect(validateContentBatch(batch, manifest).issues.join(" ")).toMatch(
      /assessed contextual meaning/i,
    );
  });

  it("validates a 10,000-candidate large-source ledger without losing coverage", () => {
    const chunkCount = 100;
    const candidateCount = 10_000;
    const candidates = Array.from({ length: candidateCount }, (_, index) => ({
      candidateId: `scale-candidate-${String(index + 1).padStart(5, "0")}`,
      term: `source-term-${index + 1}`,
      baseForm: `source-term-${index + 1}`,
      itemType: "word",
      decision: "filtered",
      reason:
        "Recorded as a low-value source candidate for complete accounting.",
      occurrences: [
        {
          page: (index % chunkCount) + 1,
          chunkId: `scale-chunk-${String((index % chunkCount) + 1).padStart(3, "0")}`,
          sentence: `This source sentence accounts for source-term-${index + 1} in the large ledger.`,
        },
      ],
    }));
    const chunks = Array.from({ length: chunkCount }, (_, index) => {
      const chunkId = `scale-chunk-${String(index + 1).padStart(3, "0")}`;
      return {
        chunkId,
        pageStart: index + 1,
        pageEnd: index + 1,
        status: "assessed",
        candidateIds: candidates
          .filter((_, candidateIndex) => candidateIndex % chunkCount === index)
          .map((candidate) => candidate.candidateId),
      };
    });
    const manifest = {
      formatVersion: "chatgpt-vocabulary-manifest-v1",
      manifestId: "scale-manifest-10000",
      createdAt: "2026-08-01T12:00:00.000Z",
      source: {
        name: "Large source scalability fixture",
        type: "pdf",
        contentHash: "e".repeat(64),
        totalPages: chunkCount,
        totalChunks: chunkCount,
      },
      coverage: {
        pages: chunks.map((chunk, index) => ({
          page: index + 1,
          status: "assessed",
          chunkIds: [chunk.chunkId],
        })),
        chunks,
      },
      candidates,
      counts: {
        totalCandidates: candidateCount,
        generate: 0,
        existing: 0,
        filtered: candidateCount,
        rejected: 0,
        heavyUse: 0,
        mediumUse: 0,
      },
      generationPlan: { batchSize: 10, batches: [] },
    };

    const result = validateContentManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
