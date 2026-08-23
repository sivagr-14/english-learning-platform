export const IMPORT_POLICY_VERSION = 3 as const;

export const DEFAULT_IMPORT_POLICY = Object.freeze({
  policyVersion: IMPORT_POLICY_VERSION,
  mode: "automatic" as const,
  approvalRequired: false,
  includedFrequencies: ["heavy", "medium"] as const,
  includedCefrLevels: ["B1", "B2", "C1", "C2"] as const,
  excludedCefrLevels: ["A1", "A2"] as const,
  excludeLowFrequency: true,
  excludeProperNames: true,
  excludeExtractionNoise: true,
  excludeMalformedTokens: true,
  skipExistingCompleteEntries: true,
  holdAmbiguousCandidatesForReview: true,
  assessmentBatchSizeSmall: 50,
  assessmentBatchSizeLarge: 100,
  largeAssessmentThreshold: 500,
  generationBatchMin: 50,
  generationBatchDefault: 100,
  generationBatchMax: 100,
  generationMaximumWaves: 5,
  topicMaximumAudienceBand: "informed_non_expert" as const,
  includePubliclyCommonProfessionalTerms: true,
  excludeExpertOnlyTerms: true,
  topicRelevanceLayers: ["L1", "L2", "L3", "L4", "L5"] as const,
  maxConcurrentGenerationBatches: 1,
  maxRetries: 3,
  databaseVerificationRequired: true,
});

export type ImportPolicy = typeof DEFAULT_IMPORT_POLICY;

export function importPolicySnapshot(): ImportPolicy {
  return {
    ...DEFAULT_IMPORT_POLICY,
    includedFrequencies: [...DEFAULT_IMPORT_POLICY.includedFrequencies],
    includedCefrLevels: [...DEFAULT_IMPORT_POLICY.includedCefrLevels],
    excludedCefrLevels: [...DEFAULT_IMPORT_POLICY.excludedCefrLevels],
    topicRelevanceLayers: [...DEFAULT_IMPORT_POLICY.topicRelevanceLayers],
  } as ImportPolicy;
}

export function assessmentBatchSize(candidateCount: number): number {
  return candidateCount > DEFAULT_IMPORT_POLICY.largeAssessmentThreshold
    ? DEFAULT_IMPORT_POLICY.assessmentBatchSizeLarge
    : DEFAULT_IMPORT_POLICY.assessmentBatchSizeSmall;
}
