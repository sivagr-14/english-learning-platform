import {
  ASSESSMENT_CHECKPOINT_VERSION,
  reconcileAssessmentCheckpoints,
  validateAssessmentCheckpoint,
} from "./assessment-checkpoint-contract";

const request = {
  requestId: "source-request-123",
  requestHash: "a".repeat(64),
  assessmentPlan: {
    totalGroups: 2,
    groups: [
      {
        groupId: "source-request-123:assessment:0001",
        groupNumber: 1,
        proposedCandidateIds: ["proposed-1", "proposed-2"],
      },
      {
        groupId: "source-request-123:assessment:0002",
        groupNumber: 2,
        proposedCandidateIds: ["proposed-3"],
      },
    ],
  },
};

function checkpoint(
  groupNumber: number,
  candidateIds: string[],
) {
  return {
    formatVersion: ASSESSMENT_CHECKPOINT_VERSION,
    checkpointId: `checkpoint-${groupNumber}`,
    requestId: request.requestId,
    requestHash: request.requestHash,
    groupId: request.assessmentPlan.groups[groupNumber - 1].groupId,
    groupNumber,
    totalGroups: 2,
    createdAt: "2026-08-10T20:00:00.000Z",
    proposedCandidateIds: candidateIds,
    decisions: candidateIds.map((proposedCandidateId) => ({
      proposedCandidateId,
      term: proposedCandidateId,
      decision: "filtered",
      senseDecision: "new_sense",
      senseKey: `sense-${proposedCandidateId}`,
      contextualMeaning: `Contextual meaning for ${proposedCandidateId}`,
      occurrenceIds: [`${proposedCandidateId}:0001`],
      reason: "Below the target usefulness threshold for this contextual sense.",
    })),
    recallPass: {
      completed: true as const,
      method: "blind_sentence_rescan" as const,
      findings: [],
      unresolvedFindingIds: [],
    },
    counts: {
      proposedCandidates: candidateIds.length,
      decidedCandidates: candidateIds.length,
      generate: 0,
      existing: 0,
      filtered: candidateIds.length,
      rejected: 0,
      untracked: 0 as const,
    },
  };
}

describe("resumable semantic assessment checkpoint contract", () => {
  it("accepts one exact planned group", () => {
    const result = validateAssessmentCheckpoint(
      checkpoint(1, ["proposed-1", "proposed-2"]),
      request,
    );
    expect(result.valid).toBe(true);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects partial candidate accounting", () => {
    const result = validateAssessmentCheckpoint(
      checkpoint(1, ["proposed-1"]),
      request,
    );
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/exactly match the planned group/i);
  });

  it("resumes only missing groups and freezes after full reconciliation", () => {
    const partial = reconcileAssessmentCheckpoints(request, [
      checkpoint(1, ["proposed-1", "proposed-2"]),
    ]);
    expect(partial).toMatchObject({
      readyToFreezeManifest: false,
      receivedGroups: [1],
      missingGroups: [2],
      nextGroup: 2,
    });
    expect(partial.continuationPrompt).toContain(
      "Continue assessment source-request-123",
    );

    const complete = reconcileAssessmentCheckpoints(request, [
      checkpoint(2, ["proposed-3"]),
      checkpoint(1, ["proposed-1", "proposed-2"]),
    ]);
    expect(complete).toMatchObject({
      readyToFreezeManifest: true,
      receivedGroups: [1, 2],
      missingGroups: [],
      nextGroup: null,
    });
    expect(complete.decisions).toHaveLength(3);
  });

  it("accepts an unresolved ambiguity only as an audited filtered decision", () => {
    const value = checkpoint(1, ["proposed-1", "proposed-2"]);
    value.decisions[0] = {
      ...value.decisions[0],
      decision: "filtered",
      senseDecision: "ambiguous",
      senseKey: "ambiguous-context",
      contextualMeaning: "Unresolved contextual meaning after bounded retries.",
      reason:
        "ambiguous_context: the stored sentence and surrounding context do not establish one safe meaning.",
    };
    const result = validateAssessmentCheckpoint(value, request);
    expect(result.valid).toBe(true);
  });

  it("rejects an ambiguity that would pause or generate instead of filtering", () => {
    const value = checkpoint(1, ["proposed-1", "proposed-2"]);
    value.decisions[0] = {
      ...value.decisions[0],
      senseDecision: "ambiguous",
      reason: "Needs learner attention.",
    };
    const result = validateAssessmentCheckpoint(value, request);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/ambiguous_context/i);
  });

  it("rejects conflicting immutable checkpoint content", () => {
    const original = checkpoint(1, ["proposed-1", "proposed-2"]);
    const changed = checkpoint(1, ["proposed-1", "proposed-2"]);
    changed.decisions[0].contextualMeaning = "A conflicting contextual meaning";
    const result = reconcileAssessmentCheckpoints(request, [original, changed]);
    expect(result.readyToFreezeManifest).toBe(false);
    expect(result.issues.join(" ")).toMatch(/conflicting content/i);
  });
});
