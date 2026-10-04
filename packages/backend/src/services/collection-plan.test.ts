import {
  collectionPolicy,
  createCollectionPlan,
  packDeliveryState,
} from "./collection-plan";

function manifest(count: number) {
  const candidates = Array.from({ length: count }, (_, i) => ({
    candidateId: `candidate-${i}`,
    term: `expression-${i}`,
    baseForm: `expression-${i}`,
    itemType: "word",
    decision: "generate",
    operation: "new",
    senseDecision: "new_sense",
    senseKey: `meaning-${i}`,
    cefrLevel: "B2",
    usageFrequency: "heavy",
    fluencyValue: "essential",
    categoryName: "Daily Life",
    contextualMeaning: `Demonstrated contextual meaning number ${i}.`,
    senseEvidence: {
      sentence: `Here is expression-${i} in its recorded source sentence.`,
      explanation:
        "The complete source sentence demonstrates this particular meaning.",
    },
    occurrences: [
      {
        page: 1,
        chunkId: "chunk-001",
        sentence: `Here is expression-${i} in its recorded source sentence.`,
      },
    ],
  }));
  return {
    formatVersion: "chatgpt-vocabulary-manifest-v2",
    manifestId: "test-collection-manifest",
    createdAt: "2026-10-03T12:00:00Z",
    source: {
      name: "Test fixture",
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
          candidateIds: candidates.map((c) => c.candidateId),
        },
      ],
    },
    candidates,
    counts: {
      totalCandidates: count,
      generate: count,
      existing: 0,
      filtered: 0,
      rejected: 0,
      heavyUse: count,
      mediumUse: 0,
    },
    generationPlan: {
      batchSize: 100,
      batches: Array.from({ length: Math.ceil(count / 100) }, (_, i) => ({
        batchNumber: i + 1,
        candidateIds: candidates
          .slice(i * 100, (i + 1) * 100)
          .map((c) => c.candidateId),
      })),
    },
  };
}
it("groups 800 senses into two visible packs without mutating any manifest identity", () => {
  const source = manifest(800);
  const before = JSON.stringify(source);
  const plan = createCollectionPlan("collection-test", [source]);
  expect(plan.packs.map((p) => p.entryCount)).toEqual([400, 400]);
  expect(plan.packs[1].units[0].batchNumber).toBe(5);
  expect(JSON.stringify(source)).toBe(before);
  expect(createCollectionPlan("collection-test", [source]).hash).toBe(
    plan.hash,
  );
});
it("rejects invalid manifests and duplicate manifests rather than inventing a collection", () => {
  expect(() => createCollectionPlan("collection-test", [])).toThrow();
  expect(() => createCollectionPlan("collection-test", [{}])).toThrow();
  expect(() =>
    createCollectionPlan("collection-test", [manifest(1), manifest(1)]),
  ).toThrow(/Duplicate/);
});
it("requires matching hashes, complete counts, language review and database verification", () => {
  const unit = {
    manifestId: "m",
    manifestHash: "a",
    batchNumber: 1,
    candidateIds: ["c"],
  };
  const receipt = {
    manifestId: "m",
    manifestHash: "a",
    batchNumber: 1,
    committedCount: 1,
    databaseVerified: true,
    languageReviewed: true,
    selectionReviewed: true,
  };
  expect(packDeliveryState({ units: [unit] }, [receipt]).complete).toBe(true);
  for (const change of [
    { manifestHash: "b" },
    { committedCount: 0 },
    { databaseVerified: false },
    { languageReviewed: false },
    { selectionReviewed: false },
  ])
    expect(
      packDeliveryState({ units: [unit] }, [{ ...receipt, ...change }])
        .complete,
    ).toBe(false);
});

it("supports 80,000-sense planning without padding the pilot or changing legacy hashes", () => {
  const source = manifest(400);
  const oldPlan = createCollectionPlan("pilot-test", [source]);
  const next = createCollectionPlan("pilot-test", [source], 80000);
  expect(oldPlan.policy.version).toBe("fluency-collection-2026.1");
  expect(oldPlan.policy.targetSenses).toBe(40000);
  expect(next.policy.targetSenses).toBe(80000);
  expect(next.entryCount).toBe(400);
  expect(next.packs).toEqual(oldPlan.packs);
  expect(next.hash).not.toBe(oldPlan.hash);
  expect(createCollectionPlan("pilot-test", [source]).hash).toBe(oldPlan.hash);
});
it.each([0, 399, 400.5, 200001, NaN, Infinity])(
  "rejects invalid target %s",
  (target) => {
    expect(() => collectionPolicy(target)).toThrow(/target/);
  },
);
