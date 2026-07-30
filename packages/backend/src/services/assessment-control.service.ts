import { createHash } from "crypto";
import { z } from "zod";

export const CandidateActionSchema = z.enum([
  "new",
  "update",
  "unchanged",
  "filtered",
]);

export const AssessmentCandidateSchema = z
  .object({
    clientCandidateId: z.string().min(1).max(120).optional(),
    sourceSegmentId: z.string().uuid().optional(),
    matchedWordId: z.string().uuid().optional(),
    action: CandidateActionSchema,
    item: z.string().trim().min(1).max(255),
    baseForm: z.string().trim().max(255).optional(),
    itemType: z.string().trim().max(80).optional(),
    cefrLevel: z.string().trim().max(10).optional(),
    usageFrequency: z.string().trim().max(30).optional(),
    fluencyValue: z.string().trim().max(30).optional(),
    learningPriority: z.string().trim().max(30).optional(),
    contextualMeaning: z.string().trim().optional(),
    originalSentence: z.string().trim().optional(),
    proposedCategories: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(180),
          relationship: z.enum(["primary", "secondary"]),
          subcategory: z.string().trim().max(180).optional(),
        }),
      )
      .max(4)
      .default([]),
    filterReason: z.string().trim().optional(),
  })
  .superRefine((candidate, context) => {
    if (
      (candidate.action === "update" || candidate.action === "unchanged") &&
      !candidate.matchedWordId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matchedWordId"],
        message: `${candidate.action} candidates must identify the existing entry`,
      });
    }

    if (candidate.action === "filtered" && !candidate.filterReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filterReason"],
        message: "filtered candidates must include a filter reason",
      });
    }

    const primaryCount = candidate.proposedCategories.filter(
      (category) => category.relationship === "primary",
    ).length;
    if (
      (candidate.action === "new" || candidate.action === "update") &&
      candidate.proposedCategories.length > 0 &&
      primaryCount !== 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedCategories"],
        message:
          "processable candidates must have exactly one primary category",
      });
    }
  });

export const CreateAssessmentSchema = z.object({
  operationId: z.string().trim().min(8).max(120),
  source: z.object({
    type: z.enum(["text", "pdf", "docx", "srt", "vtt", "csv", "other"]),
    name: z.string().trim().min(1).max(255),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/i),
    metadata: z.record(z.unknown()).default({}),
  }),
  candidates: z.array(AssessmentCandidateSchema).min(1).max(5000),
});

export type AssessmentCandidate = z.infer<typeof AssessmentCandidateSchema>;
export type CreateAssessmentInput = z.infer<typeof CreateAssessmentSchema>;

export interface AssessmentCounts {
  candidatesIdentified: number;
  alreadyPresentUnchanged: number;
  existingEntriesToUpdate: number;
  lowValueFilteredOut: number;
  newEntriesProposed: number;
  totalEntriesToProcess: number;
  heavyUseSelections: number;
  mediumUseSelections: number;
}

export function summarizeCandidates(
  candidates: AssessmentCandidate[],
): AssessmentCounts {
  const count = (action: AssessmentCandidate["action"]) =>
    candidates.filter((candidate) => candidate.action === action).length;
  const frequency = (value: string) =>
    candidates.filter(
      (candidate) =>
        candidate.action !== "filtered" &&
        candidate.usageFrequency?.toLowerCase() === value,
    ).length;

  const newEntriesProposed = count("new");
  const existingEntriesToUpdate = count("update");

  return {
    candidatesIdentified: candidates.length,
    alreadyPresentUnchanged: count("unchanged"),
    existingEntriesToUpdate,
    lowValueFilteredOut: count("filtered"),
    newEntriesProposed,
    totalEntriesToProcess: newEntriesProposed + existingEntriesToUpdate,
    heavyUseSelections: frequency("heavy"),
    mediumUseSelections: frequency("medium"),
  };
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class AssessmentControlService {
  constructor(private readonly database: any) {}

  async getOverview(userId: string) {
    const [assessments, jobs, vocabularyTotal, controlTotals, activeJobTotal] =
      await Promise.all([
        this.database("assessment_runs")
          .join(
            "content_sources",
            "assessment_runs.source_id",
            "content_sources.id",
          )
          .select(
            "assessment_runs.id",
            "assessment_runs.operation_id",
            "assessment_runs.status",
            "assessment_runs.counts",
            "assessment_runs.approved_at",
            "assessment_runs.completed_at",
            "assessment_runs.created_at",
            "assessment_runs.updated_at",
            "content_sources.name as source_name",
            "content_sources.source_type",
          )
          .where("assessment_runs.owner_user_id", userId)
          .orderBy("assessment_runs.created_at", "desc")
          .limit(20),
        this.database("generation_jobs")
          .join(
            "assessment_runs",
            "generation_jobs.assessment_run_id",
            "assessment_runs.id",
          )
          .join(
            "content_sources",
            "assessment_runs.source_id",
            "content_sources.id",
          )
          .select(
            "generation_jobs.id",
            "generation_jobs.assessment_run_id",
            "generation_jobs.status",
            "generation_jobs.total_items",
            "generation_jobs.completed_items",
            "generation_jobs.failed_items",
            "generation_jobs.manual_review_items",
            "generation_jobs.created_at",
            "generation_jobs.updated_at",
            "content_sources.name as source_name",
          )
          .where("generation_jobs.owner_user_id", userId)
          .orderBy("generation_jobs.created_at", "desc")
          .limit(20),
        this.database("vocabulary_words")
          .where((builder: any) =>
            builder.where("owner_user_id", userId).orWhereNull("owner_user_id"),
          )
          .countDistinct({ count: "id" })
          .first(),
        this.database("assessment_runs")
          .where("owner_user_id", userId)
          .select(
            this.database.raw("COUNT(*) AS assessments"),
            this.database.raw(
              "COUNT(*) FILTER (WHERE status = 'assessed') AS pending_approval",
            ),
          )
          .first(),
        this.database("generation_jobs")
          .where("owner_user_id", userId)
          .whereIn("status", ["approved", "processing"])
          .count({ count: "id" })
          .first(),
      ]);

    return {
      summary: {
        vocabularyEntries: Number(vocabularyTotal?.count || 0),
        assessments: Number(controlTotals?.assessments || 0),
        pendingApproval: Number(controlTotals?.pending_approval || 0),
        activeJobs: Number(activeJobTotal?.count || 0),
      },
      assessments,
      jobs,
    };
  }

  async createAssessment(userId: string, rawInput: unknown) {
    const input = CreateAssessmentSchema.parse(rawInput);
    const requestHash = stableHash(input);

    const existing = await this.database("assessment_runs")
      .where({
        owner_user_id: userId,
        operation_id: input.operationId,
      })
      .first();

    if (existing) {
      if (existing.request_hash !== requestHash) {
        const error = new Error(
          "operationId already exists with different assessment content",
        ) as Error & { status?: number };
        error.status = 409;
        throw error;
      }
      return this.getAssessment(userId, existing.id);
    }

    const counts = summarizeCandidates(input.candidates);

    return this.database.transaction(async (trx: any) => {
      const source =
        (await trx("content_sources")
          .where({
            owner_user_id: userId,
            content_hash: input.source.contentHash,
          })
          .first()) ||
        (
          await trx("content_sources")
            .insert({
              owner_user_id: userId,
              source_type: input.source.type,
              name: input.source.name,
              content_hash: input.source.contentHash,
              metadata: JSON.stringify(input.source.metadata),
            })
            .returning("*")
        )[0];

      const run = (
        await trx("assessment_runs")
          .insert({
            owner_user_id: userId,
            source_id: source.id,
            operation_id: input.operationId,
            request_hash: requestHash,
            status: "assessed",
            counts: JSON.stringify(counts),
          })
          .returning("*")
      )[0];

      await trx("assessment_candidates").insert(
        input.candidates.map((candidate) => ({
          assessment_run_id: run.id,
          source_segment_id: candidate.sourceSegmentId,
          matched_word_id: candidate.matchedWordId,
          action: candidate.action,
          item: candidate.item,
          base_form: candidate.baseForm,
          item_type: candidate.itemType,
          cefr_level: candidate.cefrLevel,
          usage_frequency: candidate.usageFrequency,
          fluency_value: candidate.fluencyValue,
          learning_priority: candidate.learningPriority,
          contextual_meaning: candidate.contextualMeaning,
          original_sentence: candidate.originalSentence,
          proposed_categories: JSON.stringify(candidate.proposedCategories),
          status:
            candidate.action === "filtered"
              ? "filtered"
              : candidate.action === "unchanged"
                ? "unchanged"
                : "proposed",
          filter_reason: candidate.filterReason,
        })),
      );

      await trx("control_audit_events").insert({
        owner_user_id: userId,
        operation_id: input.operationId,
        event_type: "assessment.created",
        entity_type: "assessment_run",
        entity_id: run.id,
        details: JSON.stringify({ counts }),
      });

      return this.getAssessment(userId, run.id, trx);
    });
  }

  async getAssessment(
    userId: string,
    assessmentId: string,
    db = this.database,
  ) {
    const run = await db("assessment_runs")
      .join(
        "content_sources",
        "assessment_runs.source_id",
        "content_sources.id",
      )
      .select(
        "assessment_runs.*",
        "content_sources.name as source_name",
        "content_sources.source_type",
      )
      .where({
        "assessment_runs.id": assessmentId,
        "assessment_runs.owner_user_id": userId,
      })
      .first();

    if (!run) {
      const error = new Error("Assessment not found") as Error & {
        status?: number;
      };
      error.status = 404;
      throw error;
    }

    const candidates = await db("assessment_candidates")
      .where({ assessment_run_id: assessmentId })
      .orderBy("created_at");

    return { ...run, candidates };
  }

  async approveAssessment(
    userId: string,
    assessmentId: string,
    candidateIds?: string[],
  ) {
    return this.database.transaction(async (trx: any) => {
      const run = await trx("assessment_runs")
        .where({ id: assessmentId, owner_user_id: userId })
        .forUpdate()
        .first();

      if (!run) {
        const error = new Error("Assessment not found") as Error & {
          status?: number;
        };
        error.status = 404;
        throw error;
      }

      const existingJob = await trx("generation_jobs")
        .where({ assessment_run_id: assessmentId, owner_user_id: userId })
        .first();
      if (existingJob) return existingJob;

      let candidateQuery = trx("assessment_candidates")
        .where({ assessment_run_id: assessmentId, status: "proposed" })
        .whereIn("action", ["new", "update"]);
      if (candidateIds?.length)
        candidateQuery = candidateQuery.whereIn("id", candidateIds);
      const candidates = await candidateQuery;

      if (!candidates.length) {
        const error = new Error(
          "No proposed candidates were selected",
        ) as Error & {
          status?: number;
        };
        error.status = 400;
        throw error;
      }

      const operationId = `${run.operation_id}:generation`;
      const job = (
        await trx("generation_jobs")
          .insert({
            owner_user_id: userId,
            assessment_run_id: assessmentId,
            operation_id: operationId,
            status: "approved",
            total_items: candidates.length,
          })
          .returning("*")
      )[0];

      await trx("generation_job_items").insert(
        candidates.map((candidate: any) => ({
          generation_job_id: job.id,
          assessment_candidate_id: candidate.id,
          status: "pending",
        })),
      );

      await trx("assessment_candidates")
        .whereIn(
          "id",
          candidates.map((candidate: any) => candidate.id),
        )
        .update({ status: "approved", updated_at: trx.fn.now() });

      await trx("assessment_runs").where({ id: assessmentId }).update({
        status: "approved",
        approved_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      await trx("control_audit_events").insert({
        owner_user_id: userId,
        operation_id: operationId,
        event_type: "assessment.approved",
        entity_type: "generation_job",
        entity_id: job.id,
        details: JSON.stringify({ approvedCandidateCount: candidates.length }),
      });

      return job;
    });
  }
}
