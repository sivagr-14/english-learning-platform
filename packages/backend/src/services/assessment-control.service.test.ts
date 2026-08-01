import {
  AssessmentCandidateSchema,
  summarizeCandidates,
} from "./assessment-control.service";

describe("ChatGPT-controlled assessment contract", () => {
  it("calculates the exact counts without mutating vocabulary", () => {
    const candidates = [
      {
        action: "new" as const,
        item: "put up with",
        usageFrequency: "Heavy",
        proposedCategories: [
          { name: "Daily Life", relationship: "primary" as const },
        ],
      },
      {
        action: "update" as const,
        item: "cut corners",
        matchedWordId: "38b7148e-3037-4dc6-a2ed-bc0e90090364",
        usageFrequency: "Medium",
        proposedCategories: [
          { name: "Work & Business", relationship: "primary" as const },
        ],
      },
      {
        action: "unchanged" as const,
        item: "figure out",
        matchedWordId: "a6e64a73-0ba0-49e1-9162-98cc4cc33925",
        usageFrequency: "Heavy",
        proposedCategories: [],
      },
      {
        action: "filtered" as const,
        item: "obsolete specialist term",
        filterReason: "Rare and not useful for active fluency",
        proposedCategories: [],
      },
    ];

    expect(summarizeCandidates(candidates)).toEqual({
      candidatesIdentified: 4,
      alreadyPresentUnchanged: 1,
      existingEntriesToUpdate: 1,
      lowValueFilteredOut: 1,
      newEntriesProposed: 1,
      totalEntriesToProcess: 2,
      heavyUseSelections: 2,
      mediumUseSelections: 1,
    });
  });

  it("requires update candidates to point to the existing entry", () => {
    const result = AssessmentCandidateSchema.safeParse({
      action: "update",
      item: "cut corners",
      proposedCategories: [
        { name: "Work & Business", relationship: "primary" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("limits processable candidates to one primary category", () => {
    const result = AssessmentCandidateSchema.safeParse({
      action: "new",
      item: "get away with",
      proposedCategories: [
        { name: "Law & Crime", relationship: "primary" },
        { name: "Daily Life", relationship: "primary" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires complete sense evidence and filters ambiguous meanings", () => {
    expect(
      AssessmentCandidateSchema.safeParse({
        action: "new",
        item: "bank",
        contextualMeaning: "The land beside a river.",
        senseDecision: "new_sense",
        proposedCategories: [
          { name: "Travel & Exploration", relationship: "primary" },
        ],
      }).success,
    ).toBe(false);

    expect(
      AssessmentCandidateSchema.safeParse({
        action: "new",
        item: "bank",
        contextualMeaning: "The source does not establish one meaning.",
        senseDecision: "ambiguous",
        senseKey: "unresolved-bank-sense",
        senseEvidence: {
          sentence: "They stopped near the bank.",
          explanation: "The context does not identify which bank is intended.",
        },
        proposedCategories: [
          { name: "Travel & Exploration", relationship: "primary" },
        ],
      }).success,
    ).toBe(false);
  });
});
