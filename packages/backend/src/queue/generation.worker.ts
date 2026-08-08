import { Worker, Job } from "bullmq";
import pLimit from "p-limit";
import { createQueueConnection } from "./connection";
import {
  GENERATION_QUEUE_NAME,
  GenerationJobData,
  GenerationJobName,
  enqueueAfterCommit,
  generationStageJobId,
  getGenerationQueue,
} from "./generation.queue";
import { GenerationJobService } from "../services/generation-job.service";
import { ContentPackService } from "../services/content-pack.service";
import { contentPackHash } from "../services/content-pack-contract";
import {
  assessChunk,
  toManifestCandidate,
  generateLessonEntry,
  buildManifestDocument,
  buildBatchDocument,
} from "../services/in-app-generation.service";
import { extractText, SourceType } from "../services/document-parser.service";
import { database } from "../utils/db";
import { logger } from "../utils/logger";
import { readJson } from "../utils/json";
import { ProviderNeutralJobRepository } from "../services/provider-neutral-job.repository";
import {
  pendingPlanMembers,
  reconstructDurableBatches,
} from "../services/durable-generation-plan";
import {
  GENERATION_WORKER_HEALTH_KEY,
  GENERATION_WORKER_HEALTH_TTL_SECONDS,
} from "./worker-health";

const jobService = new GenerationJobService(database);

/**
 * Splits into ~1,000-1,500 word chunks with paragraph boundaries preserved,
 * per the sizing already specified in docs/CHATGPT_CONTENT_PACK_WORKFLOW.md
 * for the manual ChatGPT flow. Kept identical here so both pipelines
 * produce comparable chunk granularity.
 */
function chunkText(text: string, targetWords = 1200): string[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).length;
    if (wordCount + words > targetWords && current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
      wordCount = 0;
    }
    current.push(paragraph);
    wordCount += words;
  }
  if (current.length > 0) chunks.push(current.join("\n\n"));
  return chunks;
}

async function handleExtract(
  job: Job<GenerationJobData, void, GenerationJobName>,
) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);
  const stagedSource = await database("generation_job_segments")
    .where({ generation_job_id: generationJobId, sequence_number: 0 })
    .first();
  if (!stagedSource?.original_text) {
    throw new Error("Durable staged source is missing -- cannot extract.");
  }

  await jobService.updateStatus(generationJobId, "extracting", {
    stageProgress: { chunksTotal: 0, chunksProcessed: 0 },
  });

  const extractedText = await extractText(
    record.source_type as SourceType,
    stagedSource.original_text,
  );
  const chunks = chunkText(extractedText);

  await database.transaction(async (trx: any) => {
    if (chunks.length) {
      await trx("generation_job_segments")
        .insert(
          chunks.map((content, index) => ({
            generation_job_id: generationJobId,
            sequence_number: index + 1,
            content_hash: contentPackHash(content),
            original_text: content,
            normalized_text: content,
            locator: JSON.stringify({ chunk: index + 1 }),
            status: "extracted",
          })),
        )
        .onConflict(["generation_job_id", "sequence_number"])
        .ignore();
    }
  });

  await jobService.updateStatus(generationJobId, "assessing", {
    stageProgress: { chunksTotal: chunks.length, chunksProcessed: 0 },
  });

  // The extracted (already-parsed) text replaces the raw upload in the
  // payload passed forward -- assess/generate never need to know whether
  // the original source was a PDF, SRT, or plain text again after this
  // point, which is the whole point of doing format handling here rather
  // than threading it through every downstream stage.
  await getGenerationQueue().add(
    "assess",
    { ...job.data },
    { jobId: `${generationJobId}:assess` },
  );
}

async function handleAssess(
  job: Job<GenerationJobData, void, GenerationJobName>,
) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);
  const existingProgress = readJson<Record<string, unknown>>(
    record.stage_progress,
    {},
  );

  // A previous delivery may have committed the assessment handoff but failed
  // before (or while) adding the deterministic BullMQ job. Do not assess or
  // persist twice; simply repair the queue delivery from durable state.
  if (existingProgress.manifestId && existingProgress.manifestHash) {
    await getGenerationQueue().add("generate", job.data, {
      jobId: generationStageJobId(generationJobId, "generate"),
    });
    return;
  }

  // Chunking is re-derived rather than passed through the job payload a
  // second time, to keep queue payloads small. See handleExtract for the
  // chunking function itself.
  const segmentRows = await database("generation_job_segments")
    .where({ generation_job_id: generationJobId })
    .andWhere("sequence_number", ">", 0)
    .orderBy("sequence_number");
  const chunks = segmentRows.map(
    (segment: any) => segment.normalized_text || segment.original_text || "",
  );
  const chunkIds = chunks.map(
    (_, i) => `chunk-${String(i + 1).padStart(4, "0")}`,
  );

  // Cap concurrent Gemini calls at 5 to avoid 429 rate-limit errors.
  // A 30-chunk document with Promise.all would fire 30 simultaneous requests;
  // this keeps it to at most 5 in flight at any time.
  const limit = pLimit(5);
  const rawCandidatesPerChunk = await Promise.all(
    chunks.map((chunk, index) =>
      limit(() => assessChunk(chunk, chunkIds[index])),
    ),
  );

  const manifestCandidates = rawCandidatesPerChunk.flatMap(
    (rawCandidates, chunkIndex) =>
      rawCandidates.map((raw) =>
        toManifestCandidate(raw, chunkIds[chunkIndex], chunkIndex + 1),
      ),
  );

  const manifestId = `inapp-${generationJobId}`;
  const manifestDoc = buildManifestDocument({
    manifestId,
    sourceName: record.source_name,
    sourceType: record.source_type,
    contentHash: record.source_hash,
    totalPages: chunks.length,
    candidates: manifestCandidates,
    chunkIds,
  });

  const manifestHash = contentPackHash(manifestDoc);

  await jobService.updateStatus(generationJobId, "assessing", {
    stageProgress: {
      chunksTotal: chunks.length,
      chunksProcessed: chunks.length,
      candidatesFound: manifestDoc.candidates.length,
    },
  });

  const contentPackService = new ContentPackService(database);
  const ingestResult = await contentPackService.ingestDocuments([
    {
      path: `inapp/${manifestId}/manifest.json`,
      content: JSON.stringify(manifestDoc),
    },
  ]);
  if (ingestResult.errors.length) {
    throw new Error(
      `Manifest ingestion failed: ${ingestResult.errors.map((e) => e.message).join("; ")}`,
    );
  }
  await contentPackService.claimManifest(userId, manifestId);
  const durableManifest = await database("content_pack_manifests")
    .where({ id: manifestId })
    .first();
  if (!durableManifest?.assessment_run_id) {
    throw new Error("Claimed manifest is missing its durable assessment run.");
  }
  const durableProgress = {
    ...existingProgress,
    chunksTotal: chunks.length,
    chunksProcessed: chunks.length,
    candidatesFound: manifestDoc.candidates.length,
    manifestId,
    manifestHash,
  };
  await enqueueAfterCommit(
    () =>
      database.transaction(async (trx: any) => {
        await new ProviderNeutralJobRepository(trx).recordManifest(
          generationJobId,
          manifestDoc,
        );
        await trx("generation_jobs")
          .where({ id: generationJobId })
          .update({
            assessment_run_id: durableManifest.assessment_run_id,
            manifest_id: manifestId,
            status: "generating",
            stage_progress: JSON.stringify(durableProgress),
            updated_at: new Date(),
          });
        await trx("generation_job_events").insert({
          generation_job_id: generationJobId,
          event_type: "job.generating",
          stage: "generating",
          details: JSON.stringify(durableProgress),
        });
      }),
    () =>
      getGenerationQueue().add("generate", job.data, {
        jobId: generationStageJobId(generationJobId, "generate"),
      }),
  );
}

async function handleGenerate(
  job: Job<GenerationJobData, void, GenerationJobName>,
) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);
  const progress = readJson<Record<string, any>>(record.stage_progress, {});
  const manifestId: string = progress.manifestId;
  const manifestHash: string = progress.manifestHash;
  if (!manifestId || !manifestHash) {
    throw new Error(
      "Missing manifestId/manifestHash from assess stage -- cannot generate.",
    );
  }

  const repository = new ProviderNeutralJobRepository(database);
  const initialPlan = await repository.loadGenerationPlan(generationJobId);
  if (!initialPlan.length) {
    throw new Error("Immutable generation plan is empty -- cannot generate.");
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;

  // Generate in immutable batch/position order. A row with result_id is
  // already complete and is never sent to the provider again.
  for (const member of initialPlan) {
    if (member.result_id && member.validation_status === "valid") continue;

    const candidate = readJson<any>(member.snapshot, null);
    if (!candidate) {
      throw new Error(
        `Durable candidate ${member.external_candidate_id} cannot be reconstructed.`,
      );
    }

    const previousAttempts = await database("generation_attempts")
      .where({
        generation_job_id: generationJobId,
        candidate_decision_id: member.candidate_decision_id,
      })
      .count("id as count")
      .first();
    const [attempt] = await database("generation_attempts")
      .insert({
        generation_job_id: generationJobId,
        batch_id: member.batch_id,
        candidate_decision_id: member.candidate_decision_id,
        stage: "generate",
        attempt_number: Number(previousAttempts?.count ?? 0) + 1,
        provider: record.provider,
        model: record.provider_model,
        status: "started",
      })
      .returning("*");

    let result: Awaited<ReturnType<typeof generateLessonEntry>>;
    try {
      result = await generateLessonEntry({
        candidateId: member.external_candidate_id,
        term: candidate.term,
        contextualMeaning: candidate.contextualMeaning,
        cefrLevel: candidate.cefrLevel,
        categoryName: candidate.categoryName,
      });
    } catch (error) {
      await database("generation_attempts").where({ id: attempt.id }).update({
        status: "failed",
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date(),
      });
      throw error;
    }

    if (!result) {
      await database.transaction(async (trx: any) => {
        await trx("generation_attempts").where({ id: attempt.id }).update({
          status: "validation_failed",
          completed_at: new Date(),
        });
        await trx("generation_validation_failures").insert({
          generation_job_id: generationJobId,
          candidate_decision_id: member.candidate_decision_id,
          attempt_id: attempt.id,
          code: "lesson_contract_invalid",
          message: "Generated lesson failed the shared content-pack contract.",
          details: JSON.stringify({
            candidateId: member.external_candidate_id,
            plannedBatch: member.batch_number,
            position: member.position,
          }),
        });
      });
      continue;
    }

    // This transaction is the completion boundary. The worker never marks a
    // candidate complete from the in-memory provider payload.
    const persisted = await repository.persistValidEntry({
      jobId: generationJobId,
      candidateDecisionId: member.candidate_decision_id,
      attemptId: attempt.id,
      entry: result.entry,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.estimatedCostUsd,
    });
    if (persisted === "inserted") {
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      totalCostUsd += result.estimatedCostUsd;
    }

    const completed = (await repository.loadGenerationPlan(generationJobId)).filter(
      (row: any) => row.result_id && row.validation_status === "valid",
    ).length;
    await jobService.updateStatus(generationJobId, "generating", {
      stageProgress: {
        ...progress,
        lessonsGenerated: completed,
        lessonsTotal: initialPlan.length,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
      },
      tokensUsedDelta:
        persisted === "inserted"
          ? result.inputTokens + result.outputTokens
          : 0,
      actualCostDelta: persisted === "inserted" ? result.estimatedCostUsd : 0,
    });
  }

  // Reconstruct final batches only from durable results joined to the
  // immutable plan. This preserves membership across every crash boundary.
  const finalPlan = await repository.loadGenerationPlan(generationJobId);
  const missing = pendingPlanMembers(finalPlan);
  if (missing.length) {
    throw new Error(
      `Generation incomplete: ${missing.length} of ${finalPlan.length} planned entries have no durable valid result.`,
    );
  }

  const contentPackService = new ContentPackService(database);
  const batchDocs = reconstructDurableBatches(finalPlan).map(
    ({ batchNumber, entries }) => ({
      batchNumber,
      document: buildBatchDocument({
        batchId: `${manifestId}-batch-${batchNumber}`,
        manifestId,
        manifestHash,
        batchNumber,
        entries,
      }),
    }),
  );

  const ingestResult = await contentPackService.ingestDocuments(
    batchDocs.map(({ batchNumber, document }) => ({
      path: `inapp/${manifestId}/batch-${batchNumber}.json`,
      content: JSON.stringify(document),
    })),
  );
  if (ingestResult.errors.length) {
    throw new Error(
      `Batch ingestion failed: ${ingestResult.errors.map((e) => e.message).join("; ")}`,
    );
  }

  const durableCompleted = finalPlan.length;
  if (durableCompleted !== initialPlan.length) {
    throw new Error("Final durable generation counts do not reconcile.");
  }
  await jobService.updateStatus(generationJobId, "validating", {
    stageProgress: {
      ...progress,
      lessonsGenerated: durableCompleted,
      lessonsFailedValidation: 0,
      lessonsTotal: initialPlan.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
    },
  });

  await getGenerationQueue().add("commit", job.data, {
    jobId: generationStageJobId(generationJobId, "commit"),
  });
}

async function handleCommit(
  job: Job<GenerationJobData, void, GenerationJobName>,
) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);
  const stageProgress = readJson<Record<string, any>>(
    record.stage_progress,
    {},
  );
  const manifestId: string = stageProgress.manifestId;
  if (!manifestId) throw new Error("Missing manifestId -- cannot commit.");

  const contentPackService = new ContentPackService(database);
  // approveManifest selects the proposed assessment_candidates and calls
  // commitAvailableBatches internally -- this is the exact same code path
  // the manual ChatGPT-inbox flow uses, so a word committed through the
  // in-app pipeline gets identical transactional-write + read-back
  // verification guarantees.
  const result = await contentPackService.approveManifest(userId, manifestId);

  await jobService.updateStatus(generationJobId, "committed", {
    stageProgress: {
      ...stageProgress,
      lessonsCommitted: stageProgress.lessonsGenerated ?? 0,
    },
  });
  logger.info(
    `Generation job ${generationJobId} committed via manifest ${manifestId}`,
    {
      manifestStatus: result?.status,
    },
  );
}

const handlers: Record<
  GenerationJobName,
  (job: Job<GenerationJobData, void, GenerationJobName>) => Promise<void>
> = {
  extract: handleExtract,
  assess: handleAssess,
  generate: handleGenerate,
  commit: handleCommit,
};

export function startGenerationWorker() {
  const concurrency = Number(process.env.GENERATION_WORKER_CONCURRENCY || 2);

  const worker = new Worker<GenerationJobData, void, GenerationJobName>(
    GENERATION_QUEUE_NAME,
    async (job) => {
      await jobService.incrementAttempt(job.data.generationJobId);
      await handlers[job.name](job);
    },
    { connection: createQueueConnection(), concurrency },
  );

  const healthConnection = createQueueConnection();
  const publishHealth = async () => {
    try {
      await healthConnection.set(
        GENERATION_WORKER_HEALTH_KEY,
        JSON.stringify({ pid: process.pid, readyAt: new Date().toISOString() }),
        "EX",
        GENERATION_WORKER_HEALTH_TTL_SECONDS,
      );
    } catch (error) {
      logger.error("Could not publish generation worker readiness", error);
    }
  };
  const healthTimer = setInterval(() => void publishHealth(), 5_000);
  healthTimer.unref();
  void worker.waitUntilReady().then(publishHealth);
  worker.on("closing", () => {
    clearInterval(healthTimer);
    void healthConnection.del(GENERATION_WORKER_HEALTH_KEY).catch(() => {});
    healthConnection.disconnect();
  });

  worker.on("failed", async (job, error) => {
    if (!job) return;
    logger.error(
      `Generation job ${job.data.generationJobId} failed on stage "${job.name}"`,
      error,
    );
    // Only mark the generation_jobs row failed once BullMQ has exhausted
    // its own retries (attempts: 3 with backoff, set in generation.queue.ts)
    // -- an intermediate retry attempt shouldn't surface as a failure to
    // the user-facing status.
    if (job.attemptsMade >= (job.opts.attempts || 1)) {
      await jobService.updateStatus(job.data.generationJobId, "failed", {
        errorMessage: error.message,
      });
    }
  });

  worker.on("completed", (job) => {
    logger.info(
      `Generation job ${job.data.generationJobId} stage "${job.name}" completed`,
    );
  });

  logger.info(`Generation worker started (concurrency: ${concurrency})`);
  return worker;
}
