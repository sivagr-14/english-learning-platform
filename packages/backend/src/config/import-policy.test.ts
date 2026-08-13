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
      excludeLowFrequency: true,
      generationBatchMin: 50,
      generationBatchDefault: 100,
      generationBatchMax: 100,
      generationMaximumWaves: 5,
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
  });
});
