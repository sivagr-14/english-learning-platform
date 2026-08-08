import { Knex } from "knex";
import { createHash } from "crypto";

export type GenerationJobStatus =
  | "queued"
  | "extracting"
  | "assessing"
  | "generating"
  | "validating"
  | "committed"
  | "failed";

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
  sourceType: "text" | "pdf" | "srt" | "docx" | "epub";
  sourceContent: string;
}

function statusError(message: string, status = 400): Error & { status: number } {
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

    const [job] = await this.database("generation_jobs")
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
      })
      .returning("*");
    return { job, isNew: true };
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
    if (status === "committed" || status === "failed") {
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
    await this.database("generation_jobs").where({ id: jobId }).update(updates);
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
