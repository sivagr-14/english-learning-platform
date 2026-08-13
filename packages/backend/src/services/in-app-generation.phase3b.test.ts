import { planGenerationBatches, toManifestCandidate } from "./in-app-generation.service";

describe("Gemini Phase 3B contracts", () => {
  it.each([1, 49, 50, 100, 101, 199, 1_083, 10_001])(
    "partitions %s planned entries exactly once into balanced batches",
    (count) => {
      const ids = Array.from({ length: count }, (_, index) => `cand-${index}`);
      const batches = planGenerationBatches(ids);
      expect(batches.flat()).toEqual(ids);
      expect(new Set(batches.flat()).size).toBe(count);
      if (count <= 100) {
        expect(batches).toHaveLength(1);
        expect(batches[0]).toHaveLength(count);
      } else {
        expect(
          batches.every((batch) => batch.length >= 50 && batch.length <= 100),
        ).toBe(true);
      }
    },
  );

  it("reduces 1,083 lessons to eleven balanced generation cycles", () => {
    const batches = planGenerationBatches(
      Array.from({ length: 1_083 }, (_, index) => `cand-${index}`),
    );
    expect(batches).toHaveLength(11);
    expect(batches.map((batch) => batch.length)).toEqual([
      99, 99, 99, 99, 99, 98, 98, 98, 98, 98, 98,
    ]);
  });

  it("preserves a provider-neutral filtered decision with a stable reason", () => {
    const candidate = toManifestCandidate(
      {
        candidateId: "a".repeat(32),
        term: "obscure",
        baseForm: "obscure",
        itemType: "word",
        contextualMeaning: "difficult to understand in this sentence",
        senseKey: "phase3b-test-sense",
        categoryKey: "communication.conversation_management.clarifying_meaning",
        domainKey: "communication",
        usageGroupKey: "communication.conversation_management",
        taxonomyConfidence: "high",
        cefrLevel: "C1",
        usageFrequency: "medium",
        fluencyValue: "useful",
        sourceSentence: "The reference was obscure to most readers.",
        senseExplanation: "It describes information that readers cannot understand clearly.",
        decision: "filtered",
        reason: "The learner already has this exact contextual sense.",
      },
      "chunk-0001",
      1,
    );
    expect(candidate?.decision).toBe("filtered");
    expect(candidate && "reason" in candidate ? candidate.reason : undefined).toMatch(/learner/i);
  });
});
