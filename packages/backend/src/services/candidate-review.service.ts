import { Knex } from "knex";
import {
  isValidTaxonomyPath,
} from "../data/vocabulary-taxonomy";
import { readJson } from "../utils/json";

export type ReviewAction = "approve" | "reject" | "correct" | "retry";

const editable = new Set([
  "contextualMeaning",
  "cefrLevel",
  "usageFrequency",
  "fluencyValue",
  "senseDecision",
  "taxonomy",
]);

function error(message: string, status = 400) {
  return Object.assign(new Error(message), { status });
}

function validateCorrection(patch: Record<string, unknown>) {
  for (const key of Object.keys(patch))
    if (!editable.has(key))
      throw error(`Field ${key} cannot be changed during review.`);
  if (patch.taxonomy) {
    const taxonomy = patch.taxonomy as Record<string, string>;
    if (
      !isValidTaxonomyPath(taxonomy)
    )
      throw error(
        "Taxonomy correction must use one valid approved Domain → Usage Group → Specific Category path.",
      );
  }
}

export class CandidateReviewService {
  constructor(private readonly db: Knex) {}

  async list(
    userId: string,
    jobId: string,
    filters: Record<string, string | undefined>,
  ) {
    const job = await this.db("generation_jobs")
      .where({ id: jobId, user_id: userId })
      .first();
    if (!job) throw error("Generation job not found.", 404);
    const query = this.db("generation_candidate_decisions as candidate")
      .leftJoin(
        "generation_plan_members as member",
        "member.candidate_decision_id",
        "candidate.id",
      )
      .leftJoin(
        "generation_plan_batches as batch",
        "batch.id",
        "member.batch_id",
      )
      .where("candidate.generation_job_id", jobId)
      .select("candidate.*", "batch.batch_number", "member.position")
      .orderBy("candidate.created_at");
    if (filters.decision)
      query.andWhere("candidate.decision", filters.decision);
    if (filters.reviewStatus)
      query.andWhere("candidate.review_status", filters.reviewStatus);
    const rows = await query;
    const ids = rows.map((row: any) => row.id);
    const occurrences = ids.length
      ? await this.db("generation_candidate_occurrences")
          .whereIn("candidate_decision_id", ids)
          .orderBy("occurrence_number")
      : [];
    const byCandidate = new Map<string, any[]>();
    for (const occurrence of occurrences)
      byCandidate.set(occurrence.candidate_decision_id, [
        ...(byCandidate.get(occurrence.candidate_decision_id) || []),
        occurrence,
      ]);
    const candidates = rows.map((row: any) => {
      const snapshot = readJson<any>(row.review_override || row.snapshot, {});
      return { ...row, snapshot, occurrences: byCandidate.get(row.id) || [] };
    });
    const unresolved = candidates.filter(
      (candidate: any) => candidate.review_status === "attention_required",
    ).length;
    return { job, candidates, unresolved, completionBlocked: unresolved > 0 };
  }

  async act(
    userId: string,
    jobId: string,
    candidateIds: string[],
    action: ReviewAction,
    patch: Record<string, unknown>,
    reason: string,
  ) {
    if (!candidateIds.length) throw error("Select at least one candidate.");
    if (!reason.trim()) throw error("An audit reason is required.");
    if (action === "correct") validateCorrection(patch);
    return this.db.transaction(async (trx: any) => {
      const job = await trx("generation_jobs")
        .where({ id: jobId, user_id: userId })
        .forUpdate()
        .first();
      if (!job) throw error("Generation job not found.", 404);
      const rows = await trx("generation_candidate_decisions")
        .where({ generation_job_id: jobId })
        .whereIn("id", candidateIds)
        .forUpdate();
      if (rows.length !== candidateIds.length)
        throw error("One or more candidates do not belong to this job.", 404);
      for (const row of rows) {
        const before = readJson<any>(row.review_override || row.snapshot, {});
        const after = action === "correct" ? { ...before, ...patch } : before;
        const version = Number(row.review_version || 0) + 1;
        const reviewStatus =
          action === "reject"
            ? "rejected"
            : action === "retry"
              ? "attention_required"
              : "approved";
        await trx("generation_candidate_reviews").insert({
          generation_job_id: jobId,
          candidate_decision_id: row.id,
          reviewer_user_id: userId,
          version,
          action,
          before_snapshot: JSON.stringify(before),
          after_snapshot: JSON.stringify(after),
          reason,
        });
        await trx("generation_candidate_decisions")
          .where({ id: row.id })
          .update({
            review_status: reviewStatus,
            review_override: JSON.stringify(after),
            review_version: version,
            reviewed_at: new Date(),
            updated_at: new Date(),
          });
      }
      const unresolvedRow = await trx("generation_candidate_decisions")
        .where({
          generation_job_id: jobId,
          review_status: "attention_required",
        })
        .count("id as count")
        .first();
      const unresolved = Number(unresolvedRow?.count || 0);
      await trx("generation_job_events").insert({
        generation_job_id: jobId,
        event_type: `candidate_review.${action}`,
        stage: "review",
        details: JSON.stringify({ candidateIds, reason, unresolved }),
      });
      if (
        unresolved > 0 &&
        !["failed", "cancelled", "committed"].includes(job.status)
      )
        await trx("generation_jobs")
          .where({ id: jobId })
          .update({ status: "attention_required", updated_at: new Date() });
      return {
        updated: rows.length,
        unresolved,
        completionBlocked: unresolved > 0,
      };
    });
  }
}
