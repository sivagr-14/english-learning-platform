export const IMPORT_POLICY_VERSION = 1 as const;

export const DEFAULT_IMPORT_POLICY = Object.freeze({
  policyVersion: IMPORT_POLICY_VERSION,
  mode: "automatic" as const,
  approvalRequired: false,
  includedFrequencies: ["heavy", "medium"] as const,
  excludeLowFrequency: true,
  excludeProperNames: true,
  excludeExtractionNoise: true,
  excludeMalformedTokens: true,
  skipExistingCompleteEntries: true,
  holdAmbiguousCandidatesForReview: true,
  assessmentBatchSizeSmall: 50,
  assessmentBatchSizeLarge: 100,
  largeAssessmentThreshold: 500,
  generationBatchMin: 5,
  generationBatchDefault: 8,
  generationBatchMax: 10,
  maxConcurrentGenerationBatches: 1,
  maxRetries: 3,
  databaseVerificationRequired: true,
});

export type ImportPolicy = typeof DEFAULT_IMPORT_POLICY;

export function importPolicySnapshot(): ImportPolicy {
  return {
    ...DEFAULT_IMPORT_POLICY,
    includedFrequencies: [...DEFAULT_IMPORT_POLICY.includedFrequencies],
  } as ImportPolicy;
}

export function assessmentBatchSize(candidateCount: number): number {
  return candidateCount > DEFAULT_IMPORT_POLICY.largeAssessmentThreshold
    ? DEFAULT_IMPORT_POLICY.assessmentBatchSizeLarge
    : DEFAULT_IMPORT_POLICY.assessmentBatchSizeSmall;
}

