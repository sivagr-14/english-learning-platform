import { createHash } from "crypto";
import { Knex } from "knex";

export type GenerationProvider = "chatgpt" | "gemini";

export interface JobIdentityInput {
  sourceHash: string;
  promptVersion: string;
  contractVersion: string;
  policySnapshot: unknown;
}

export interface ProviderMetadata {
  provider: GenerationProvider;
  model: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function durableHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

/** Provider and model are deliberately excluded from manifest identity. */
export function manifestIdentity(input: JobIdentityInput): string {
  return durableHash({
    sourceHash: input.sourceHash,
    promptVersion: input.promptVersion,
    contractVersion: input.contractVersion,
    policySnapshot: input.policySnapshot,
  });
}

export class ProviderNeutralJobRepository {
  constructor(private readonly database: Knex) {}

  async attachMetadata(
    jobId: string,
    identity: JobIdentityInput,
    provider: ProviderMetadata,
  ): Promise<void> {
    await this.database("generation_jobs")
      .where({ id: jobId })
      .update({
        provider: provider.provider,
        provider_model: provider.model,
        prompt_version: identity.promptVersion,
        contract_version: identity.contractVersion,
        manifest_identity: manifestIdentity(identity),
        policy_hash: durableHash(identity.policySnapshot),
        policy_snapshot: JSON.stringify(identity.policySnapshot),
        updated_at: new Date(),
      });
  }

  async appendEvent(
    jobId: string,
    eventType: string,
    details: Record<string, unknown> = {},
    stage?: string,
  ): Promise<void> {
    await this.database("generation_job_events").insert({
      generation_job_id: jobId,
      event_type: eventType,
      stage: stage ?? null,
      details: JSON.stringify(details),
    });
  }

  async recordManifest(jobId: string, manifest: any): Promise<void> {
    await this.database.transaction(async (trx: any) => {
      const decisionIdByExternal = new Map<string, string>();
      for (const candidate of manifest.candidates ?? []) {
        const normalizedTerm = String(candidate.term ?? candidate.item ?? "")
          .normalize("NFKC")
          .trim()
          .toLocaleLowerCase("en");
        const senseKey =
          candidate.senseKey ||
          durableHash({
            term: normalizedTerm,
            meaning: candidate.contextualMeaning ?? "legacy-unspecified",
          }).slice(0, 32);
        const [decision] = await trx("generation_candidate_decisions")
          .insert({
            generation_job_id: jobId,
            external_candidate_id: candidate.candidateId,
            normalized_term: normalizedTerm,
            sense_key: senseKey,
            decision: candidate.decision,
            reason_code: candidate.reasonCode ?? null,
            reason: candidate.reason ?? candidate.decisionReason ?? null,
            snapshot: JSON.stringify(candidate),
          })
          .onConflict(["generation_job_id", "external_candidate_id"])
          .ignore()
          .returning("*");
        const stored =
          decision ??
          (await trx("generation_candidate_decisions")
            .where({
              generation_job_id: jobId,
              external_candidate_id: candidate.candidateId,
            })
            .first());
        decisionIdByExternal.set(candidate.candidateId, stored.id);

        const occurrences = candidate.occurrences ?? [];
        if (occurrences.length) {
          await trx("generation_candidate_occurrences")
            .insert(
              occurrences.map((occurrence: any, index: number) => ({
                candidate_decision_id: stored.id,
                occurrence_number: index + 1,
                surface_form: occurrence.surfaceForm ?? candidate.term,
                sentence: occurrence.sentence,
                locator: JSON.stringify(occurrence),
              })),
            )
            .onConflict(["candidate_decision_id", "occurrence_number"])
            .ignore();
        }
      }

      for (const planned of manifest.generationPlan?.batches ?? []) {
        const candidateIds = planned.candidateIds ?? [];
        const [batch] = await trx("generation_plan_batches")
          .insert({
            generation_job_id: jobId,
            batch_number: planned.batchNumber,
            immutable_hash: durableHash(candidateIds),
            status: "planned",
          })
          .onConflict(["generation_job_id", "batch_number"])
          .ignore()
          .returning("*");
        const storedBatch =
          batch ??
          (await trx("generation_plan_batches")
            .where({
              generation_job_id: jobId,
              batch_number: planned.batchNumber,
            })
            .first());
        const members = candidateIds
          .map((candidateId: string, index: number) => ({
            batch_id: storedBatch.id,
            candidate_decision_id: decisionIdByExternal.get(candidateId),
            position: index + 1,
          }))
          .filter((member: any) => member.candidate_decision_id);
        if (members.length) {
          await trx("generation_plan_members")
            .insert(members)
            .onConflict(["batch_id", "candidate_decision_id"])
            .ignore();
        }
      }
    });
  }

  /**
   * Loads the immutable generation plan in exact batch/position order and
   * attaches any already-persisted valid result. This is the only resume
   * source: mutable progress JSON and provider response order are ignored.
   */
  async loadGenerationPlan(jobId: string) {
    return this.database("generation_plan_members as member")
      .join("generation_plan_batches as batch", "member.batch_id", "batch.id")
      .join(
        "generation_candidate_decisions as candidate",
        "member.candidate_decision_id",
        "candidate.id",
      )
      .leftJoin("generation_results as result", function (this: any) {
        this.on("result.generation_job_id", "=", "batch.generation_job_id").andOn(
          "result.candidate_decision_id",
          "=",
          "candidate.id",
        );
      })
      .where("batch.generation_job_id", jobId)
      .select(
        "batch.id as batch_id",
        "batch.batch_number",
        "batch.immutable_hash as batch_hash",
        "member.position",
        "candidate.id as candidate_decision_id",
        "candidate.external_candidate_id",
        "candidate.snapshot",
        "result.id as result_id",
        "result.content_hash as result_hash",
        "result.entry_payload",
        "result.validation_status",
      )
      .orderBy([
        { column: "batch.batch_number", order: "asc" },
        { column: "member.position", order: "asc" },
      ]);
  }

  /**
   * Atomically records the successful attempt and schema-valid entry. A
   * repeated identical result is a no-op; changed content for the same
   * candidate is an immutable-ID conflict.
   */
  async persistValidEntry(input: {
    jobId: string;
    candidateDecisionId: string;
    attemptId: string;
    entry: unknown;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }): Promise<"inserted" | "existing"> {
    const hash = durableHash(input.entry);
    return this.database.transaction(async (trx: any) => {
      const existing = await trx("generation_results")
        .where({
          generation_job_id: input.jobId,
          candidate_decision_id: input.candidateDecisionId,
        })
        .forUpdate()
        .first();

      if (existing && existing.content_hash !== hash) {
        throw new Error(
          "Durable generation result conflict: candidate already has different content.",
        );
      }

      if (!existing) {
        await trx("generation_results").insert({
          generation_job_id: input.jobId,
          candidate_decision_id: input.candidateDecisionId,
          attempt_id: input.attemptId,
          content_hash: hash,
          entry_payload: JSON.stringify(input.entry),
          validation_status: "valid",
        });
      }

      await trx("generation_attempts").where({ id: input.attemptId }).update({
        status: "succeeded",
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        cost_usd: input.costUsd,
        completed_at: new Date(),
      });
      return existing ? "existing" : "inserted";
    });
  }

  async reconstruct(jobId: string) {
    const job = await this.database("generation_jobs")
      .where({ id: jobId })
      .first();
    if (!job) return null;

    const [segments, decisions, batches, attempts, results, failures, events] =
      await Promise.all([
        this.database("generation_job_segments")
          .where({ generation_job_id: jobId })
          .orderBy("sequence_number"),
        this.database("generation_candidate_decisions")
          .where({ generation_job_id: jobId })
          .orderBy("created_at"),
        this.database("generation_plan_batches")
          .where({ generation_job_id: jobId })
          .orderBy("batch_number"),
        this.database("generation_attempts")
          .where({ generation_job_id: jobId })
          .orderBy(["started_at", "attempt_number"]),
        this.database("generation_results")
          .where({ generation_job_id: jobId })
          .orderBy("created_at"),
        this.database("generation_validation_failures")
          .where({ generation_job_id: jobId })
          .orderBy("created_at"),
        this.database("generation_job_events")
          .where({ generation_job_id: jobId })
          .orderBy(["created_at", "id"]),
      ]);

    const decisionIds = decisions.map((decision: any) => decision.id);
    const batchIds = batches.map((batch: any) => batch.id);
    const [occurrences, planMembers] = await Promise.all([
      decisionIds.length
        ? this.database("generation_candidate_occurrences")
            .whereIn("candidate_decision_id", decisionIds)
            .orderBy("occurrence_number")
        : [],
      batchIds.length
        ? this.database("generation_plan_members")
            .whereIn("batch_id", batchIds)
            .orderBy(["batch_id", "position"])
        : [],
    ]);

    return {
      job,
      segments,
      decisions,
      occurrences,
      batches,
      planMembers,
      attempts,
      results,
      failures,
      events,
    };
  }
}
