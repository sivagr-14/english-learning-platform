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
  // Carried through the job payload only (not persisted on the
  // generation_jobs row, to keep that table small) -- for "text" sources
  // this is the raw pasted text. Phase 3's PDF/SRT/etc. parsers will read
  // from a staged upload path instead of carrying full file contents
  // through Redis.
  sourceContent?: string;
  // Present on assess/generate/commit once extract has produced them.
  chunkIndex?: number;
  totalChunks?: number;
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
  await getGenerationQueue().add("extract", data);
}
