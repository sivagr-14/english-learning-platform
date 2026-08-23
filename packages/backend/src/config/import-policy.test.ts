import {
  assessmentBatchSize,
  DEFAULT_IMPORT_POLICY,
  importPolicySnapshot,
} from "./import-policy";

describe("default import policy", () => {
  it("uses automatic high/medium generation without approval", () => {
    expect(DEFAULT_IMPORT_POLICY).toMatchObject({
      mode: "automatic",
      approvalRequired: false,
      includedFrequencies: ["heavy", "medium"],
      includedCefrLevels: ["B1", "B2", "C1", "C2"],
      excludedCefrLevels: ["A1", "A2"],
      excludeLowFrequency: true,
      generationBatchMin: 50,
      generationBatchDefault: 100,
      generationBatchMax: 100,
      generationMaximumWaves: 5,
      topicMaximumAudienceBand: "informed_non_expert",
      includePubliclyCommonProfessionalTerms: true,
      excludeExpertOnlyTerms: true,
      topicRelevanceLayers: ["L1", "L2", "L3", "L4", "L5"],
      maxRetries: 3,
      databaseVerificationRequired: true,
    });
  });

  it("chooses bounded assessment batches without limiting the total", () => {
    expect(assessmentBatchSize(500)).toBe(50);
    expect(assessmentBatchSize(501)).toBe(100);
    expect(assessmentBatchSize(50_000)).toBe(100);
  });

  it("returns a detached snapshot for durable imports", () => {
    const snapshot = importPolicySnapshot();
    expect(snapshot).toEqual(DEFAULT_IMPORT_POLICY);
    expect(snapshot).not.toBe(DEFAULT_IMPORT_POLICY);
    expect(snapshot.includedFrequencies).not.toBe(
      DEFAULT_IMPORT_POLICY.includedFrequencies,
    );
    expect(snapshot.includedCefrLevels).not.toBe(
      DEFAULT_IMPORT_POLICY.includedCefrLevels,
    );
    expect(snapshot.topicRelevanceLayers).not.toBe(
      DEFAULT_IMPORT_POLICY.topicRelevanceLayers,
    );
  });
});
