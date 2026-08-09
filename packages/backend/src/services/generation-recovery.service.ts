import { Knex } from "knex";
import { GenerationJobName } from "../queue/generation.queue";
import { readJson } from "../utils/json";
import { pendingPlanMembers } from "./durable-generation-plan";
import { ProviderNeutralJobRepository } from "./provider-neutral-job.repository";

function recoveryError(message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = 409;
  return error;
}

/** Selects a resume stage exclusively from durable PostgreSQL state. */
export async function selectGenerationResumeStage(
  database: Knex,
  userId: string,
  jobId: string,
): Promise<{ stage: GenerationJobName; progressPatch?: Record<string, unknown> }> {
  const job = await database("generation_jobs")
    .where({ id: jobId, user_id: userId })
    .first();
  if (!job) throw recoveryError("Generation job not found.");
  if (job.status === "committed")
    throw recoveryError("This generation job is already completed and verified.");
  if (job.cancellation_requested_at || job.status === "cancelled")
    throw recoveryError("A cancelled generation job cannot be resumed.");

  if (job.manifest_id) {
    const manifest = await database("content_pack_manifests")
      .where({ id: job.manifest_id, owner_user_id: userId })
      .first();
    if (!manifest)
      throw recoveryError("The durable manifest required for recovery is missing.");
    const plan = await new ProviderNeutralJobRepository(database)
      .loadGenerationPlan(jobId);
    if (!plan.length)
      throw recoveryError("The immutable generation plan required for recovery is empty.");
    const progress = readJson<Record<string, unknown>>(job.stage_progress, {});
    const progressPatch = {
      ...progress,
      manifestId: manifest.id,
      manifestHash: manifest.manifest_hash,
    };
    return {
      stage: pendingPlanMembers(plan).length ? "generate" : "commit",
      progressPatch,
    };
  }

  const extracted = await database("generation_job_segments")
    .where({ generation_job_id: jobId })
    .andWhere("sequence_number", ">", 0)
    .first();
  if (extracted) return { stage: "assess" };

  const stagedSource = await database("generation_job_segments")
    .where({ generation_job_id: jobId, sequence_number: 0 })
    .first();
  if (job.staged_upload_path || stagedSource?.original_text)
    return { stage: "extract" };
  throw recoveryError("No durable source remains from which this job can resume.");
}
