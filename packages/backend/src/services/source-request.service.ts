import { createHash } from "crypto";
import { z } from "zod";
import {
  TAXONOMY_DOMAINS,
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_USAGE_GROUPS,
  TAXONOMY_VERSION,
} from "../data/vocabulary-taxonomy";
import { balancedAssessmentGroups } from "./assessment-batching";
import {
  buildInventory,
  resolveSourceType,
} from "../scripts/build-content-inventory";

export const CreateSourceRequestSchema = z
  .object({
    sourceName: z.string().trim().min(1).max(255),
    sourceType: z.string().trim().max(20).optional(),
    contentBase64: z.string().min(1),
  })
  .superRefine((value, context) => {
    let bytes: Buffer;
    try {
      bytes = Buffer.from(value.contentBase64, "base64");
    } catch {
      bytes = Buffer.alloc(0);
    }
    if (!bytes.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentBase64"],
        message: "The uploaded source is empty or is not valid base64.",
      });
    if (bytes.length > 25 * 1024 * 1024)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentBase64"],
        message: "The uploaded source exceeds the 25 MB safety limit.",
      });
  });

export type CreateSourceRequestInput = z.infer<
  typeof CreateSourceRequestSchema
>;

function groupsOf<T>(values: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    groups.push(values.slice(index, index + size));
  return groups;
}

export async function buildPortableAssessmentRequest(
  database: any,
  userId: string,
  rawInput: unknown,
) {
  const input = CreateSourceRequestSchema.parse(rawInput);
  const bytes = Buffer.from(input.contentBase64, "base64");
  const sourceType = resolveSourceType(input.sourceName, input.sourceType);
  const inventory = await buildInventory({
    bytes,
    sourceName: input.sourceName,
    sourceType,
  });

  const normalizedTerms = [
    ...new Set(
      inventory.occurrences.map((occurrence) => occurrence.normalizedTerm),
    ),
  ];
  const existingVocabulary: Array<{
    id: string;
    word: string;
    normalized_term: string;
    sense_rank: number;
    sense_key?: string | null;
    sense_gloss?: string | null;
    english_meaning?: string | null;
  }> = [];
  for (const terms of groupsOf(normalizedTerms, 1000)) {
    if (!terms.length) continue;
    const matches = await database("vocabulary_words")
      .select(
        "id",
        "word",
        "normalized_term",
        "sense_rank",
        "sense_key",
        "sense_gloss",
        "english_meaning",
      )
      .where((builder: any) =>
        builder.where("owner_user_id", userId).orWhereNull("owner_user_id"),
      )
      .whereIn("normalized_term", terms);
    existingVocabulary.push(...matches);
  }

  const requestId = `source-request-${inventory.inventoryHash.slice(0, 24)}`;
  const proposedCandidateIds = [
    ...new Set(
      inventory.occurrences.map(
        (occurrence) => occurrence.proposedCandidateId,
      ),
    ),
  ];
  const candidateGroups = balancedAssessmentGroups(proposedCandidateIds);
  const recallGroups = groupsOf(
    inventory.expressionRecallUnits,
    Math.max(
      1,
      Math.ceil(
        inventory.expressionRecallUnits.length /
          Math.max(1, candidateGroups.length),
      ),
    ),
  );
  const groupCount = Math.max(candidateGroups.length, recallGroups.length);
  const assessmentGroups = Array.from({ length: groupCount }, (_, index) => {
    const candidateIds = candidateGroups[index] ?? [];
    const recallUnits = recallGroups[index] ?? [];
    const groupNumber = index + 1;
    const candidateSet = new Set(candidateIds);
    const groupOccurrences = inventory.occurrences.filter((occurrence) =>
      candidateSet.has(occurrence.proposedCandidateId),
    );
    return {
      groupId: `${requestId}:assessment:${String(groupNumber).padStart(4, "0")}`,
      groupNumber,
      proposedCandidateIds: candidateIds,
      candidateOccurrenceIds: Object.fromEntries(
        candidateIds.map((candidateId) => [
          candidateId,
          groupOccurrences
            .filter(
              (occurrence) => occurrence.proposedCandidateId === candidateId,
            )
            .map((occurrence) => occurrence.occurrenceId),
        ]),
      ),
      recallUnitIds: recallUnits.map((unit) => unit.recallUnitId),
      occurrenceIds: groupOccurrences.map(
        (occurrence) => occurrence.occurrenceId,
      ),
      status: "pending" as const,
    };
  });
  const plannedRecallUnitIds = assessmentGroups.flatMap(
    (group) => group.recallUnitIds,
  );
  const expectedRecallUnitIds = inventory.expressionRecallUnits.map(
    (unit) => unit.recallUnitId,
  );
  if (
    new Set(plannedRecallUnitIds).size !== plannedRecallUnitIds.length ||
    JSON.stringify([...plannedRecallUnitIds].sort()) !==
      JSON.stringify([...expectedRecallUnitIds].sort())
  )
    throw new Error(
      "Assessment planning did not assign every expression recall unit exactly once.",
    );
  const envelope = {
    formatVersion: "chatgpt-assessment-request-v1",
    requestId,
    immutableIdentity: {
      sourceHash: inventory.source.sourceHash,
      inventoryHash: inventory.inventoryHash,
      taxonomyVersion: TAXONOMY_VERSION,
    },
    instructions: {
      workflowPath: "docs/CHATGPT_CONTENT_PACK_WORKFLOW.md",
      lessonPath: "VOCABULARY_GENERATION_INSTRUCTIONS.md",
      requiredManifestVersion: "chatgpt-vocabulary-manifest-v5",
      assessmentCheckpointVersion:
        "chatgpt-semantic-assessment-checkpoint-v1",
      handoff:
        "Attach this request to ChatGPT and write Generate. That single command authorizes the complete unattended assessment and generation drain. Process every immutable assessment group continuously without approval, confirmation or continue prompts; deliver each checkpoint durably and resume only missing groups. Freeze the v5 manifest only after all groups reconcile, then generate, validate, deliver and remotely verify every planned lesson cycle continuously.",
    },
    inventory,
    assessmentPlan: {
      groupSize: 100,
      groupingPolicy: "fewest-balanced-50-100-v1",
      automaticContinuation: true,
      totalGroups: assessmentGroups.length,
      groups: assessmentGroups,
      checkpointPathTemplate:
        `assessment-checkpoints/${requestId}/group-{groupNumber}.checkpoint.json`,
      completionRule:
        "Every planned group must have one valid immutable checkpoint, every proposed candidate occurrence must belong to exactly one contextual-sense decision, every recall unit must be independently rescanned, and every recall finding must be resolved before the manifest is frozen.",
    },
    existingVocabulary,
    taxonomy: {
      version: TAXONOMY_VERSION,
      domains: TAXONOMY_DOMAINS,
      usageGroups: TAXONOMY_USAGE_GROUPS,
      specificCategories: TAXONOMY_SPECIFIC_CATEGORIES,
    },
    reconciliation: {
      sourceUnits: inventory.source.segmentCount,
      processingChunks: inventory.source.processingChunkCount,
      readableWords: inventory.source.readableWordCount,
      inventoryOccurrences: inventory.counts.occurrences,
      existingVocabularyMatches: existingVocabulary.length,
      proposedCandidates: proposedCandidateIds.length,
      expressionRecallUnits: inventory.expressionRecallUnits.length,
      trackedExpressionRecallUnits: assessmentGroups.reduce(
        (total, group) => total + group.recallUnitIds.length,
        0,
      ),
      untrackedExpressionRecallUnits: 0,
      assessmentGroups: assessmentGroups.length,
      untrackedReadableUnits:
        inventory.chunkReconciliation.untrackedReadableUnits,
      untrackedReadableWords:
        inventory.chunkReconciliation.untrackedReadableWords,
    },
  };
  const requestHash = createHash("sha256")
    .update(JSON.stringify(envelope))
    .digest("hex");
  return { ...envelope, requestHash };
}
