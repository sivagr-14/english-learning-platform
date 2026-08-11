import { createHash } from "crypto";
import { z } from "zod";

export const ASSESSMENT_CHECKPOINT_VERSION =
  "chatgpt-semantic-assessment-checkpoint-v1" as const;

const IdentifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(180)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const UsefulTextSchema = z.string().trim().min(3).max(10_000);

export const AssessmentDecisionSchema = z
  .object({
    proposedCandidateId: IdentifierSchema,
    term: z.string().trim().min(1).max(500),
    decision: z.enum(["generate", "existing", "filtered", "rejected"]),
    senseDecision: z.enum(["same_sense", "new_sense", "ambiguous"]),
    senseKey: IdentifierSchema,
    contextualMeaning: UsefulTextSchema,
    occurrenceIds: z.array(IdentifierSchema).min(1).max(500),
    matchedWordId: z.string().uuid().optional(),
    reason: UsefulTextSchema.optional(),
  })
  .strict()
  .superRefine((decision, context) => {
    if (decision.decision !== "generate" && !decision.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "non-generated decisions require a specific reason",
      });
    }
    if (decision.decision === "existing" && !decision.matchedWordId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matchedWordId"],
        message: "existing decisions require a verified PostgreSQL word identity",
      });
    }
    if (
      decision.decision === "generate" &&
      decision.senseDecision === "ambiguous"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senseDecision"],
        message: "ambiguous senses cannot be generated",
      });
    }
    if (
      decision.senseDecision === "ambiguous" &&
      (decision.decision !== "filtered" ||
        !decision.reason?.startsWith("ambiguous_context"))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["decision"],
        message:
          "ambiguous senses must be filtered with an ambiguous_context reason after bounded retries",
      });
    }
  });

export const AssessmentCheckpointSchema = z
  .object({
    formatVersion: z.literal(ASSESSMENT_CHECKPOINT_VERSION),
    checkpointId: IdentifierSchema,
    requestId: IdentifierSchema,
    requestHash: Sha256Schema,
    groupId: IdentifierSchema,
    groupNumber: z.number().int().positive(),
    totalGroups: z.number().int().positive(),
    createdAt: z.string().datetime(),
    proposedCandidateIds: z.array(IdentifierSchema).max(100),
    recallUnitIds: z.array(IdentifierSchema).max(500).optional(),
    decisions: z.array(AssessmentDecisionSchema).max(500),
    recallPass: z
      .object({
        completed: z.literal(true),
        method: z.literal("blind_sentence_rescan"),
        scannedRecallUnitIds: z.array(IdentifierSchema).max(500).optional(),
        findings: z
          .array(
            z
              .object({
                findingId: IdentifierSchema,
                occurrenceId: IdentifierSchema.optional(),
                recallUnitId: IdentifierSchema.optional(),
                term: z.string().trim().min(1).max(500),
                linkedProposedCandidateId: IdentifierSchema.optional(),
                sentence: UsefulTextSchema.optional(),
                startOffset: z.number().int().nonnegative().optional(),
                endOffset: z.number().int().positive().optional(),
                reason: UsefulTextSchema,
              })
              .strict()
              .superRefine((finding, context) => {
                if (!finding.occurrenceId && !finding.recallUnitId)
                  context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                      "a recall finding must link to a deterministic occurrence or sentence recall unit",
                  });
                if (
                  finding.recallUnitId &&
                  (!finding.sentence ||
                    finding.startOffset === undefined ||
                    finding.endOffset === undefined ||
                    finding.endOffset <= finding.startOffset)
                )
                  context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message:
                      "a newly discovered expression requires its exact sentence and source offsets",
                  });
              }),
          )
          .max(500),
        unresolvedFindingIds: z.array(IdentifierSchema).max(0),
      })
      .strict(),
    counts: z
      .object({
        proposedCandidates: z.number().int().nonnegative(),
        decidedCandidates: z.number().int().nonnegative(),
        generate: z.number().int().nonnegative(),
        existing: z.number().int().nonnegative(),
        filtered: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        untracked: z.literal(0),
      })
      .strict(),
  })
  .strict();

export type AssessmentCheckpoint = z.infer<
  typeof AssessmentCheckpointSchema
>;

export interface AssessmentGroupReference {
  groupId: string;
  groupNumber: number;
  proposedCandidateIds: string[];
  candidateOccurrenceIds?: Record<string, string[]>;
  recallUnitIds?: string[];
}

export interface AssessmentRequestReference {
  requestId: string;
  requestHash: string;
  assessmentPlan: {
    totalGroups: number;
    groups: AssessmentGroupReference[];
  };
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

export function assessmentCheckpointHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateAssessmentCheckpoint(
  raw: unknown,
  request: AssessmentRequestReference,
) {
  const parsed = AssessmentCheckpointSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false as const,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }

  const checkpoint = parsed.data;
  const issues: string[] = [];
  const expected = request.assessmentPlan.groups.find(
    (group) => group.groupId === checkpoint.groupId,
  );
  if (checkpoint.requestId !== request.requestId)
    issues.push("requestId: does not match the immutable source request");
  if (checkpoint.requestHash !== request.requestHash)
    issues.push("requestHash: does not match the immutable source request");
  if (!expected) issues.push("groupId: is not present in the assessment plan");
  if (checkpoint.totalGroups !== request.assessmentPlan.totalGroups)
    issues.push("totalGroups: does not match the assessment plan");
  if (expected && checkpoint.groupNumber !== expected.groupNumber)
    issues.push("groupNumber: does not match the planned group");

  const planned = expected?.proposedCandidateIds || [];
  if (
    JSON.stringify([...checkpoint.proposedCandidateIds].sort()) !==
    JSON.stringify([...planned].sort())
  )
    issues.push("proposedCandidateIds: must exactly match the planned group");

  if (expected?.recallUnitIds) {
    if (
      JSON.stringify([...(checkpoint.recallUnitIds ?? [])].sort()) !==
      JSON.stringify([...expected.recallUnitIds].sort())
    )
      issues.push("recallUnitIds: must exactly match the planned group");
    if (
      JSON.stringify(
        [...(checkpoint.recallPass.scannedRecallUnitIds ?? [])].sort(),
      ) !== JSON.stringify([...expected.recallUnitIds].sort())
    )
      issues.push(
        "recallPass.scannedRecallUnitIds: every planned sentence must be rescanned exactly once",
      );
    const plannedRecallUnits = new Set(expected.recallUnitIds);
    for (const finding of checkpoint.recallPass.findings)
      if (finding.recallUnitId && !plannedRecallUnits.has(finding.recallUnitId))
        issues.push(
          `recallPass.findings: ${finding.findingId} references a recall unit outside this group`,
        );
  }

  const decided = checkpoint.decisions.map(
    (decision) => decision.proposedCandidateId,
  );
  const decidedSenseInstances = checkpoint.decisions.map(
    (decision) => `${decision.proposedCandidateId}:${decision.senseKey}`,
  );
  if (duplicates(decidedSenseInstances).length)
    issues.push(
      "decisions: a proposed candidate may contain multiple senses, but each candidate/senseKey pair must be unique",
    );
  if (
    JSON.stringify([...new Set(decided)].sort()) !==
    JSON.stringify([...planned].sort())
  )
    issues.push("decisions: must account for every planned candidate");

  if (expected?.candidateOccurrenceIds) {
    for (const candidateId of planned) {
      const expectedOccurrences =
        expected.candidateOccurrenceIds[candidateId] ?? [];
      const decidedOccurrences = checkpoint.decisions
        .filter((decision) => decision.proposedCandidateId === candidateId)
        .flatMap((decision) => decision.occurrenceIds);
      if (duplicates(decidedOccurrences).length)
        issues.push(
          `decisions: ${candidateId} assigns one occurrence to multiple contextual senses`,
        );
      if (
        JSON.stringify([...decidedOccurrences].sort()) !==
        JSON.stringify([...expectedOccurrences].sort())
      )
        issues.push(
          `decisions: ${candidateId} must assign every source occurrence to exactly one contextual sense`,
        );
    }
  }

  const recomputed = checkpoint.decisions.reduce(
    (counts, decision) => {
      counts[decision.decision] += 1;
      return counts;
    },
    { generate: 0, existing: 0, filtered: 0, rejected: 0 },
  );
  if (
    checkpoint.counts.proposedCandidates !== planned.length ||
    checkpoint.counts.decidedCandidates !== checkpoint.decisions.length ||
    checkpoint.counts.generate !== recomputed.generate ||
    checkpoint.counts.existing !== recomputed.existing ||
    checkpoint.counts.filtered !== recomputed.filtered ||
    checkpoint.counts.rejected !== recomputed.rejected
  )
    issues.push("counts: declared semantic decisions do not reconcile");

  return {
    valid: issues.length === 0,
    value: checkpoint,
    issues,
    hash: assessmentCheckpointHash(checkpoint),
  };
}

export function reconcileAssessmentCheckpoints(
  request: AssessmentRequestReference,
  rawCheckpoints: unknown[],
) {
  const accepted = new Map<string, AssessmentCheckpoint>();
  const issues: string[] = [];

  for (const raw of rawCheckpoints) {
    const validation = validateAssessmentCheckpoint(raw, request);
    if (!validation.valid || !validation.value) {
      issues.push(...validation.issues);
      continue;
    }
    const existing = accepted.get(validation.value.groupId);
    if (
      existing &&
      assessmentCheckpointHash(existing) !==
        assessmentCheckpointHash(validation.value)
    ) {
      issues.push(
        `${validation.value.groupId}: immutable checkpoint identity has conflicting content`,
      );
      continue;
    }
    accepted.set(validation.value.groupId, validation.value);
  }

  const missingGroups = request.assessmentPlan.groups
    .filter((group) => !accepted.has(group.groupId))
    .map((group) => group.groupNumber);
  const checkpoints = request.assessmentPlan.groups
    .map((group) => accepted.get(group.groupId))
    .filter((value): value is AssessmentCheckpoint => Boolean(value));

  return {
    readyToFreezeManifest: issues.length === 0 && missingGroups.length === 0,
    receivedGroups: checkpoints.map((checkpoint) => checkpoint.groupNumber),
    missingGroups,
    nextGroup: missingGroups[0] ?? null,
    decisions: checkpoints.flatMap((checkpoint) => checkpoint.decisions),
    issues,
    continuationPrompt: missingGroups.length
      ? `Continue assessment ${request.requestId}. Preserve the immutable request and completed checkpoint identities. Assess only missing groups ${missingGroups.join(", ")}, starting with group ${missingGroups[0]}.`
      : null,
  };
}
