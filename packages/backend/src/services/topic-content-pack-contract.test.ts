import { TopicManifestCandidateSchema } from "./content-pack-contract";

const baseCandidate = {
  candidateId: "topic-pain-throbbing",
  term: "throbbing pain",
  baseForm: "throbbing pain",
  itemType: "collocation",
  decision: "generate",
  operation: "new",
  senseDecision: "new_sense",
  senseKey: "rhythmic-pulsing-pain",
  cefrLevel: "B2",
  usageFrequency: "heavy",
  fluencyValue: "essential",
  categoryName: "Symptoms and conditions",
  contextualMeaning: "Pain that repeatedly pulses or beats in a regular way.",
  senseEvidence: {
    sentence: "I have a throbbing pain behind my left eye.",
    explanation: "The generated scenario demonstrates a rhythmic pulsing sensation.",
  },
  taxonomy: {
    taxonomyVersion: "vocabulary-taxonomy-2026.2",
    domainKey: "health",
    usageGroupKey: "symptoms-and-medical-care",
    categoryKey: "symptoms-and-conditions",
    confidence: "high",
  },
  occurrences: [{
    page: 1,
    chunkId: "topic-pain-symptoms",
    sentence: "I have a throbbing pain behind my left eye.",
  }],
  evidenceType: "generated_topic_scenario",
  topicEvidence: {
    relevanceLayer: "L2",
    audienceBand: "informed_non_expert",
    publicUsefulness: "high",
    relevanceReason: "People commonly use this distinction when describing pain.",
    coverageBranchIds: ["pain-types-and-sensations"],
    communicationFunctions: ["describe-symptoms"],
  },
};

describe("topic candidate contract", () => {
  it("accepts B1-C2 informed non-expert vocabulary", () => {
    expect(TopicManifestCandidateSchema.safeParse(baseCandidate).success).toBe(true);
  });

  it.each(["A1", "A2"])("rejects generated %s vocabulary", (cefrLevel) => {
    const result = TopicManifestCandidateSchema.safeParse({
      ...baseCandidate,
      cefrLevel,
    });
    expect(result.success).toBe(false);
  });

  it("rejects expert-only generation under the default policy", () => {
    const result = TopicManifestCandidateSchema.safeParse({
      ...baseCandidate,
      topicEvidence: {
        ...baseCandidate.topicEvidence,
        audienceBand: "expert_only",
      },
    });
    expect(result.success).toBe(false);
  });
});
