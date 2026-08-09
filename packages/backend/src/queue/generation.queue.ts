import { Queue } from "bullmq";
import { createQueueConnection } from "./connection";

export const GENERATION_QUEUE_NAME = "content-generation";

/**
 * Every job on this queue is one pipeline stage for one generation job.
 * The worker (generation.worker.ts) reads `name` to dispatch to the right
 * stage handler. A stage handler, on success, enqueues the next stage's
 * job itself -- this keeps the queue as the single source of truth for
 * "what happens next" instead of splitting that logic between the API
 * routes and the worker.
 *
 * extract   -> parse the raw source into clean text + segment boundaries
 *              (stage 3 of this build: format-specific parsers)
 * assess    -> cheap-model candidate extraction per chunk
 *              (stage 3: model integration)
 * generate  -> lesson generation per approved candidate, validator-gated,
 *              with escalation to a stronger model on failure
 *              (stage 3: model integration)
 * commit    -> transactional Postgres write + read-back verification,
 *              reusing ContentPackService's existing commit path
 */
export type GenerationJobName = "extract" | "assess" | "generate" | "commit";

export interface GenerationJobData {
  generationJobId: string;
  userId: string;
}

export function generationStageJobId(
  generationJobId: string,
  stage: GenerationJobName,
): string {
  return `${generationJobId}:${stage}`;
}

/** Enforces the durable-state-before-delivery boundary for stage handoffs. */
export async function enqueueAfterCommit(
  persist: () => Promise<void>,
  enqueue: () => Promise<unknown>,
): Promise<void> {
  await persist();
  await enqueue();
}

let queue: Queue<GenerationJobData, void, GenerationJobName> | null = null;

export function getGenerationQueue() {
  if (!queue) {
    queue = new Queue<GenerationJobData, void, GenerationJobName>(
      GENERATION_QUEUE_NAME,
      {
        connection: createQueueConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      },
    );
  }
  return queue;
}

export async function enqueueExtraction(data: GenerationJobData) {
  await getGenerationQueue().add("extract", data, {
    jobId: generationStageJobId(data.generationJobId, "extract"),
  });
}

/**
 * Re-deliver one durable pipeline stage without being defeated by BullMQ's
 * retained completed/failed job IDs. Active delivery is left alone; terminal
 * delivery records are removed only after PostgreSQL has selected the exact
 * resume stage.
 */
export async function enqueueGenerationResume(
  stage: GenerationJobName,
  data: GenerationJobData,
): Promise<"enqueued" | "already_running"> {
  const queue = getGenerationQueue();
  const jobId = generationStageJobId(data.generationJobId, stage);
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (["active", "waiting", "delayed", "prioritized", "waiting-children"].includes(state)) {
      return "already_running";
    }
    await existing.remove();
  }
  await queue.add(stage, data, { jobId });
  return "enqueued";
}
