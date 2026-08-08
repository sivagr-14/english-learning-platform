import { Knex } from "knex";
import { createHash } from "crypto";
import { importPolicySnapshot } from "../config/import-policy";
import {
  durableHash,
  manifestIdentity,
} from "./provider-neutral-job.repository";

export type GenerationJobStatus =
  | "queued"
  | "extracting"
  | "assessing"
  | "generating"
  | "validating"
  | "committed"
  | "attention_required"
  | "failed"
  | "cancelled";

export interface StageProgress {
  chunksTotal?: number;
  chunksProcessed?: number;
  candidatesFound?: number;
  lessonsGenerated?: number;
  lessonsCommitted?: number;
  lessonsFailedValidation?: number;
  [key: string]: unknown;
}

export interface CreateGenerationJobInput {
  userId: string;
  sourceName: string;
  sourceType: "text" | "md" | "html" | "vtt" | "pdf" | "srt" | "docx" | "epub";
  sourceContent: string;
}

export interface CreateStagedGenerationJobInput extends Omit<
  CreateGenerationJobInput,
  "sourceContent"
> {
  sourceHash: string;
  stagedUploadPath: string;
  stagedUploadSize: number;
}

function statusError(
  message: string,
  status = 400,
): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

export class GenerationJobService {
  constructor(private readonly database: Knex) {}

  /**
   * Creates a job row keyed on (user, content-hash). Reusing the same
   * source (re-uploading the same PDF, retrying after a crash) returns the
   * existing job instead of creating a duplicate pipeline run -- this is
   * the same idempotency pattern already used for content-pack manifests.
   */
  async create(input: CreateGenerationJobInput) {
    const sourceHash = createHash("sha256")
      .update(input.sourceContent)
      .digest("hex");

    const existing = await this.database("generation_jobs")
      .where({ user_id: input.userId, source_hash: sourceHash })
      .first();
    if (existing) return { job: existing, isNew: false };

    const policySnapshot = importPolicySnapshot();
    const promptVersion = "in-app-generation-v1";
    const contractVersion = "chatgpt-vocabulary-manifest-v3/simplified-v2";

    const result = await this.database.transaction(async (trx: any) => {
      const [source] = await trx("content_sources")
        .insert({
          owner_user_id: input.userId,
          source_type: input.sourceType,
          name: input.sourceName,
          content_hash: sourceHash,
          metadata: JSON.stringify({ origin: "in-app" }),
        })
        .onConflict(["owner_user_id", "content_hash"])
        .merge(["name", "source_type", "updated_at"])
        .returning("*");

      const [job] = await trx("generation_jobs")
        .insert({
          user_id: input.userId,
          owner_user_id: input.userId,
          operation_id: `in-app:${sourceHash}`,
          source_name: input.sourceName,
          source_type: input.sourceType,
          source_hash: sourceHash,
          status: "queued",
          total_items: 0,
          stage_progress: JSON.stringify({}),
          provider: "gemini",
          provider_model: process.env.PRIMARY_AI_MODEL || "gemini-2.0-flash",
          prompt_version: promptVersion,
          contract_version: contractVersion,
          manifest_identity: manifestIdentity({
            sourceHash,
            promptVersion,
            contractVersion,
            policySnapshot,
          }),
          policy_hash: durableHash(policySnapshot),
          policy_snapshot: JSON.stringify(policySnapshot),
        })
        .returning("*");

      const segmentHash = createHash("sha256")
        .update(input.sourceContent)
        .digest("hex");
      await trx("generation_job_segments").insert({
        generation_job_id: job.id,
        sequence_number: 0,
        content_hash: segmentHash,
        original_text: input.sourceContent,
        normalized_text: null,
        locator: JSON.stringify({ sourceId: source.id, kind: "staged-source" }),
        status: "staged",
      });
      await trx("generation_job_events").insert({
        generation_job_id: job.id,
        event_type: "job.created",
        stage: "queued",
        details: JSON.stringify({ sourceId: source.id }),
      });
      return job;
    });
    return { job: result, isNew: true };
  }

  async createFromStagedUpload(input: CreateStagedGenerationJobInput) {
    const existing = await this.database("generation_jobs")
      .where({ user_id: input.userId, source_hash: input.sourceHash })
      .first();
    if (existing) return { job: existing, isNew: false };
    const policySnapshot = importPolicySnapshot();
    const promptVersion = "in-app-generation-v1";
    const contractVersion = "chatgpt-vocabulary-manifest-v3/simplified-v2";
    const job = await this.database.transaction(async (trx: any) => {
      const [source] = await trx("content_sources")
        .insert({
          owner_user_id: input.userId,
          source_type: input.sourceType,
          name: input.sourceName,
          content_hash: input.sourceHash,
          metadata: JSON.stringify({ origin: "in-app", staged: true }),
        })
        .onConflict(["owner_user_id", "content_hash"])
        .merge(["name", "source_type", "updated_at"])
        .returning("*");
      const [created] = await trx("generation_jobs")
        .insert({
          user_id: input.userId,
          owner_user_id: input.userId,
          operation_id: `in-app:${input.sourceHash}`,
          source_name: input.sourceName,
          source_type: input.sourceType,
          source_hash: input.sourceHash,
          status: "queued",
          total_items: 0,
          stage_progress: JSON.stringify({}),
          provider: "gemini",
          provider_model: process.env.PRIMARY_AI_MODEL || "gemini-2.0-flash",
          prompt_version: promptVersion,
          contract_version: contractVersion,
          manifest_identity: manifestIdentity({
            sourceHash: input.sourceHash,
            promptVersion,
            contractVersion,
            policySnapshot,
          }),
          policy_hash: durableHash(policySnapshot),
          policy_snapshot: JSON.stringify(policySnapshot),
          staged_upload_path: input.stagedUploadPath,
          staged_upload_size: input.stagedUploadSize,
          staged_upload_hash: input.sourceHash,
        })
        .returning("*");
      await trx("generation_job_events").insert({
        generation_job_id: created.id,
        event_type: "upload.staged",
        stage: "queued",
        details: JSON.stringify({
          sourceId: source.id,
          bytes: input.stagedUploadSize,
          sha256: input.sourceHash,
        }),
      });
      return created;
    });
    return { job, isNew: true };
  }

  async requestCancellation(userId: string, jobId: string) {
    const job = await this.get(userId, jobId);
    if (["committed", "failed", "cancelled"].includes(job.status)) return job;
    const [updated] = await this.database("generation_jobs")
      .where({ id: jobId, user_id: userId })
      .update({
        cancellation_requested_at: new Date(),
        terminal_reason: "user_cancelled",
        updated_at: new Date(),
      })
      .returning("*");
    return updated;
  }

  async get(userId: string, jobId: string) {
    const job = await this.database("generation_jobs")
      .where({ id: jobId, user_id: userId })
      .first();
    if (!job) throw statusError("Generation job not found", 404);
    return job;
  }

  async list(userId: string) {
    return this.database("generation_jobs")
      .where({ user_id: userId })
      .orderBy("created_at", "desc")
      .limit(50);
  }

  async updateStatus(
    jobId: string,
    status: GenerationJobStatus,
    patch: Partial<{
      stageProgress: StageProgress;
      errorMessage: string | null;
      actualCostDelta: number;
      tokensUsedDelta: number;
    }> = {},
  ) {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };
    if (patch.stageProgress) {
      updates.stage_progress = JSON.stringify(patch.stageProgress);
    }
    if (patch.errorMessage !== undefined) {
      updates.error_message = patch.errorMessage;
    }
    if (
      status === "committed" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      updates.completed_at = new Date();
    }
    if (patch.actualCostDelta) {
      updates.actual_cost = this.database.raw("actual_cost + ?", [
        patch.actualCostDelta,
      ]);
    }
    if (patch.tokensUsedDelta) {
      updates.tokens_used = this.database.raw("tokens_used + ?", [
        patch.tokensUsedDelta,
      ]);
    }
    await this.database.transaction(async (trx: any) => {
      await trx("generation_jobs").where({ id: jobId }).update(updates);
      await trx("generation_job_events").insert({
        generation_job_id: jobId,
        event_type: `job.${status}`,
        stage: status,
        details: JSON.stringify(patch.stageProgress ?? {}),
      });
    });
  }

  async incrementAttempt(jobId: string) {
    await this.database("generation_jobs")
      .where({ id: jobId })
      .update({
        attempt_count: this.database.raw("attempt_count + 1"),
        updated_at: new Date(),
      });
  }
}
