import { planGenerationBatches, toManifestCandidate } from "./in-app-generation.service";

describe("Gemini Phase 3B contracts", () => {
  it.each([11, 12, 15, 17, 23, 41])(
    "partitions %s planned entries exactly once into balanced batches",
    (count) => {
      const ids = Array.from({ length: count }, (_, index) => `cand-${index}`);
      const batches = planGenerationBatches(ids);
      expect(batches.flat()).toEqual(ids);
      expect(new Set(batches.flat()).size).toBe(count);
      expect(batches.every((batch) => batch.length >= 5 && batch.length <= 10)).toBe(true);
    },
  );

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
