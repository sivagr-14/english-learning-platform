import { createHash } from "crypto";
import { z } from "zod";
import {
  TAXONOMY_DOMAINS,
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_USAGE_GROUPS,
  TAXONOMY_VERSION,
} from "../data/vocabulary-taxonomy";
import { importPolicySnapshot } from "../config/import-policy";

export const UNIVERSAL_TOPIC_DIMENSIONS = [
  "definition-and-core-concepts",
  "types-varieties-and-classifications",
  "parts-components-and-elements",
  "people-and-roles",
  "actions-and-processes",
  "properties-qualities-and-descriptions",
  "conditions-states-and-changes",
  "location-position-direction-and-movement",
  "quantity-intensity-degree-and-measurement",
  "time-duration-sequence-and-frequency",
  "causes-and-contributing-factors",
  "effects-and-consequences",
  "common-situations-and-interactions",
  "problems-failures-risks-and-warning-signs",
  "solutions-responses-and-prevention",
  "tools-equipment-and-resources",
  "rules-responsibilities-and-decisions",
  "questions-answers-requests-and-instructions",
  "feelings-reactions-opinions-and-evaluations",
  "comparisons-alternatives-and-choices",
  "formal-and-professional-communication",
  "common-technical-language",
  "news-and-public-discussion",
  "broader-social-economic-cultural-technical-environmental-context",
  "idioms-collocations-phrasal-verbs-and-patterns",
] as const;

export const CreateTopicRequestSchema = z.object({
  topic: z.string().trim().min(2).max(200),
  intendedContext: z.string().trim().min(2).max(1000).optional(),
}).strict();

export async function buildPortableTopicRequest(
  database: any,
  userId: string,
  rawInput: unknown,
) {
  const input = CreateTopicRequestSchema.parse(rawInput);
  const normalizedTopic = input.topic.toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
  const policy = importPolicySnapshot();
  const existingVocabulary = await database("vocabulary_words")
    .select(
      "id",
      "word",
      "normalized_term",
      "sense_rank",
      "sense_key",
      "sense_gloss",
      "english_meaning",
      "cefr_level",
    )
    .where((builder: any) =>
      builder.where("owner_user_id", userId).orWhereNull("owner_user_id"),
    )
    .orderBy(["normalized_term", "sense_rank"]);

  const identityPayload = {
    normalizedTopic,
    intendedContext: input.intendedContext || null,
    taxonomyVersion: TAXONOMY_VERSION,
    existingVocabulary: existingVocabulary.map((item: any) => [
      item.id,
      item.normalized_term,
      item.sense_rank,
      item.sense_key,
    ]),
    policy,
  };
  const requestHash = createHash("sha256")
    .update(JSON.stringify(identityPayload))
    .digest("hex");
  const requestId = `topic-request-${requestHash.slice(0, 24)}`;

  return {
    formatVersion: "chatgpt-topic-request-v1" as const,
    requestId,
    requestHash,
    createdAt: new Date().toISOString(),
    topic: {
      suppliedTopic: input.topic,
      normalizedTopic,
      intendedContext: input.intendedContext || null,
    },
    instructions: {
      workflowPath: "docs/CHATGPT_CONTENT_PACK_WORKFLOW.md",
      lessonPath: "VOCABULARY_GENERATION_INSTRUCTIONS.md",
      requiredManifestVersion: "chatgpt-topic-vocabulary-manifest-v1",
      requiredBatchVersion: "chatgpt-topic-vocabulary-batch-v1",
      handoff:
        "Attach this request to ChatGPT and write Generate. Dynamically decompose any topic, cover every applicable universal and topic-specific branch through L1-L5, and generate only B1-C2 vocabulary through the informed-non-expert ceiling. Freeze the complete reconciled manifest, then drain every missing 50-100 lesson cycle across at most five balanced waves without approval, confirmation or continue prompts.",
    },
    discoveryPolicy: {
      cefr: {
        include: ["B1", "B2", "C1", "C2"],
        exclude: ["A1", "A2"],
      },
      relevanceLayers: ["L1", "L2", "L3", "L4", "L5"],
      maximumAudienceBand: "informed_non_expert",
      includePubliclyCommonProfessionalTerms: true,
      excludeExpertOnlyTerms: true,
      includeItemTypes: [
        "word",
        "phrasal verb",
        "idiom",
        "collocation",
        "fixed phrase",
        "conversational pattern",
      ],
      countPolicy:
        "The reconciled coverage ledger determines the total; never select a target count.",
      ambiguityPolicy:
        "Ask only when competing topic interpretations would materially change the complete vocabulary map.",
    },
    coveragePlan: {
      universalDimensions: UNIVERSAL_TOPIC_DIMENSIONS.map((dimensionId) => ({
        dimensionId,
        status: "pending",
      })),
      requireDynamicTopicBranches: true,
      allowedFinalStatuses: [
        "covered",
        "not_applicable",
        "expert_only_excluded",
        "low_frequency_excluded",
      ],
      blockingStatus: "coverage_gap",
      completionRule:
        "Every applicable universal dimension and dynamically discovered topic branch must be reconciled; coverage gaps, unresolved recall findings and untracked candidates must all be zero.",
    },
    communicationCoverage: [
      "identify-and-describe",
      "explain-how-it-works",
      "describe-typical-situations",
      "ask-and-answer",
      "give-instructions-or-advice",
      "describe-problems-and-risks",
      "propose-solutions",
      "compare-alternatives",
      "express-opinions",
      "understand-dialogue",
      "understand-formal-or-news-discussion",
      "discuss-broader-consequences",
    ],
    executionPolicy: {
      automaticContinuation: true,
      approvalRequired: false,
      generationCycleMin: policy.generationBatchMin,
      generationCycleDefault: policy.generationBatchDefault,
      generationCycleMax: policy.generationBatchMax,
      maximumWaves: policy.generationMaximumWaves,
      maximumConcurrentCycles: policy.maxConcurrentGenerationBatches,
      maxRetries: policy.maxRetries,
      wavePolicy:
        "Use one wave for up to 100 generated candidates; otherwise divide all immutable cycles into at most five deterministic balanced waves. A completed cycle or wave is never a stopping condition.",
      resumePolicy:
        "Rediscover remote receipts and resume from the first missing immutable cycle without reassessment or confirmation.",
    },
    existingVocabulary,
    taxonomy: {
      version: TAXONOMY_VERSION,
      domains: TAXONOMY_DOMAINS,
      usageGroups: TAXONOMY_USAGE_GROUPS,
      specificCategories: TAXONOMY_SPECIFIC_CATEGORIES,
    },
  };
}
