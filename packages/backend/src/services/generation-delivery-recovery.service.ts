import { database } from "../utils/db";
import { logger } from "../utils/logger";
import { enqueueGenerationResume } from "../queue/generation.queue";
import { selectGenerationResumeStage } from "./generation-recovery.service";

const RECOVERABLE_STATUSES = [
  "queued",
  "extracting",
  "assessing",
  "generating",
  "validating",
];

/**
 * PostgreSQL is the durable source of truth. Redis deliveries can be lost when
 * a process stops between committing a job row and adding its BullMQ stage.
 * Reconcile every non-terminal row when the worker starts; deterministic IDs
 * make this safe when a delivery is already active.
 */
export async function recoverGenerationDeliveries(): Promise<{
  inspected: number;
  enqueued: number;
  alreadyRunning: number;
  failed: number;
}> {
  const jobs = await database("generation_jobs")
    .whereIn("status", RECOVERABLE_STATUSES)
    .select("id", "owner_user_id", "user_id");

  const result = {
    inspected: jobs.length,
    enqueued: 0,
    alreadyRunning: 0,
    failed: 0,
  };

  for (const job of jobs) {
    const userId = String(job.owner_user_id || job.user_id || "");
    if (!userId) {
      result.failed += 1;
      logger.error(
        `Could not recover generation job ${job.id}: owner is missing`,
      );
      continue;
    }

    try {
      const recovery = await selectGenerationResumeStage(
        database,
        userId,
        String(job.id),
      );
      const delivery = await enqueueGenerationResume(recovery.stage, {
        generationJobId: String(job.id),
        userId,
      });
      if (delivery === "enqueued") result.enqueued += 1;
      else result.alreadyRunning += 1;
    } catch (error) {
      result.failed += 1;
      logger.error(
        `Could not recover generation job ${job.id}`,
        error,
      );
    }
  }

  logger.info(
    `Generation delivery recovery inspected ${result.inspected} job(s): ${result.enqueued} enqueued, ${result.alreadyRunning} already running, ${result.failed} failed`,
  );
  return result;
}
