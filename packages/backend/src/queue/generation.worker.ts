import { Worker, Job } from "bullmq";
import pLimit from "p-limit";
import { createQueueConnection } from "./connection";
import {
  GENERATION_QUEUE_NAME,
  GenerationJobData,
  GenerationJobName,
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
  chunkIntoBatches,
} from "../services/in-app-generation.service";
import { submitGeminiBatch, configFor } from "../services/ai-provider.service";
import { extractText, SourceType } from "../services/document-parser.service";
import { database } from "../utils/db";
import { logger } from "../utils/logger";
import { readJson } from "../utils/json";

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

async function handleExtract(job: Job<GenerationJobData, void, GenerationJobName>) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);

  await jobService.updateStatus(generationJobId, "extracting", {
    stageProgress: { chunksTotal: 0, chunksProcessed: 0 },
  });

  const extractedText = await extractText(
    record.source_type as SourceType,
    job.data.sourceContent || "",
  );
  const chunks = chunkText(extractedText);

  await jobService.updateStatus(generationJobId, "assessing", {
    stageProgress: { chunksTotal: chunks.length, chunksProcessed: 0 },
  });

  // The extracted (already-parsed) text replaces the raw upload in the
  // payload passed forward -- assess/generate never need to know whether
  // the original source was a PDF, SRT, or plain text again after this
  // point, which is the whole point of doing format handling here rather
  // than threading it through every downstream stage.
  await getGenerationQueue().add("assess", {
    ...job.data,
    sourceContent: extractedText,
    totalChunks: chunks.length,
  });
}

async function handleAssess(job: Job<GenerationJobData, void, GenerationJobName>) {
  const { generationJobId, userId, totalChunks } = job.data;
  const record = await jobService.get(userId, generationJobId);

  // Chunking is re-derived rather than passed through the job payload a
  // second time, to keep queue payloads small. See handleExtract for the
  // chunking function itself.
  const chunks = chunkText(job.data.sourceContent || "");
  const chunkIds = chunks.map((_, i) => `chunk-${String(i + 1).padStart(4, "0")}`);

  // Cap concurrent Gemini calls at 5 to avoid 429 rate-limit errors.
  // A 30-chunk document with Promise.all would fire 30 simultaneous requests;
  // this keeps it to at most 5 in flight at any time.
  const limit = pLimit(5);
  const rawCandidatesPerChunk = await Promise.all(
    chunks.map((chunk, index) => limit(() => assessChunk(chunk, chunkIds[index]))),
  );

  const manifestCandidates = rawCandidatesPerChunk.flatMap((rawCandidates, chunkIndex) =>
    rawCandidates.map((raw) => toManifestCandidate(raw, chunkIds[chunkIndex], chunkIndex + 1)),
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
    { path: `inapp/${manifestId}/manifest.json`, content: JSON.stringify(manifestDoc) },
  ]);
  if (ingestResult.errors.length) {
    throw new Error(
      `Manifest ingestion failed: ${ingestResult.errors.map((e) => e.message).join("; ")}`,
    );
  }
  await contentPackService.claimManifest(userId, manifestId);

  await jobService.updateStatus(generationJobId, "generating", {
    stageProgress: {
      chunksTotal: chunks.length,
      chunksProcessed: chunks.length,
      candidatesFound: manifestDoc.candidates.length,
    },
  });

  await getGenerationQueue().add("generate", {
    ...job.data,
    totalChunks: totalChunks ?? chunks.length,
  } as GenerationJobData);
  const existingProgress = readJson<Record<string, unknown>>(record.stage_progress, {});
  await database("generation_jobs")
    .where({ id: generationJobId })
    .update({
      stage_progress: JSON.stringify({
        ...existingProgress,
        chunksTotal: chunks.length,
        chunksProcessed: chunks.length,
        candidatesFound: manifestDoc.candidates.length,
        manifestId,
        manifestHash,
      }),
      updated_at: new Date(),
    });
}

async function handleGenerate(job: Job<GenerationJobData, void, GenerationJobName>) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);
  const progress = readJson<Record<string, any>>(record.stage_progress, {});
  const manifestId: string = progress.manifestId;
  const manifestHash: string = progress.manifestHash;
  if (!manifestId || !manifestHash) {
    throw new Error("Missing manifestId/manifestHash from assess stage -- cannot generate.");
  }

  const contentPackService = new ContentPackService(database);
  const manifestRow = await database("content_pack_manifests")
    .where({ id: manifestId })
    .first();
  if (!manifestRow) throw new Error(`Manifest ${manifestId} not found`);
  const manifest = readJson<any>(manifestRow.payload, null);
  if (!manifest) throw new Error(`Manifest ${manifestId} payload could not be read`);

  const generateCandidates = manifest.candidates.filter(
    (c: any) => c.decision === "generate",
  );

  // Resume support (B9): on a BullMQ retry the progress JSON may already
  // contain candidateIds that succeeded before the crash. Skip them rather
  // than re-paying for duplicate generation.
  const completedIds = new Set<string>(progress.completedCandidateIds ?? []);

  let lessonsGenerated = Number(progress.lessonsGenerated ?? 0);
  let lessonsFailedValidation = Number(progress.lessonsFailedValidation ?? 0);
  let totalInputTokens = Number(progress.totalInputTokens ?? 0);
  let totalOutputTokens = Number(progress.totalOutputTokens ?? 0);
  let totalCostUsd = Number(progress.totalCostUsd ?? 0);
  const entries: any[] = [];

  for (const candidate of generateCandidates) {
    if (completedIds.has(candidate.candidateId)) continue;

    const result = await generateLessonEntry({
      candidateId: candidate.candidateId,
      term: candidate.term,
      contextualMeaning: candidate.contextualMeaning,
      cefrLevel: candidate.cefrLevel,
      categoryName: candidate.categoryName,
    });
    if (result) {
      entries.push(result.entry);
      lessonsGenerated += 1;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      totalCostUsd += result.estimatedCostUsd;
      completedIds.add(candidate.candidateId);
    } else {
      lessonsFailedValidation += 1;
    }
    await jobService.updateStatus(generationJobId, "generating", {
      stageProgress: {
        ...progress,
        lessonsGenerated,
        lessonsFailedValidation,
        lessonsTotal: generateCandidates.length,
        completedCandidateIds: Array.from(completedIds),
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(6)),
      },
      tokensUsedDelta: result?.inputTokens ?? 0 + (result?.outputTokens ?? 0),
      actualCostDelta: result?.estimatedCostUsd ?? 0,
    });
  }

  const batches = chunkIntoBatches(entries, 10);
  const batchDocs = batches.map((batchEntries, index) =>
    buildBatchDocument({
      batchId: `${manifestId}-batch-${index + 1}`,
      manifestId,
      manifestHash,
      batchNumber: index + 1,
      entries: batchEntries,
    }),
  );

  if (batchDocs.length) {
    const ingestResult = await contentPackService.ingestDocuments(
      batchDocs.map((doc, index) => ({
        path: `inapp/${manifestId}/batch-${index + 1}.json`,
        content: JSON.stringify(doc),
      })),
    );
    if (ingestResult.errors.length) {
      throw new Error(
        `Batch ingestion failed: ${ingestResult.errors.map((e) => e.message).join("; ")}`,
      );
    }
  }

  await jobService.updateStatus(generationJobId, "validating", {
    stageProgress: {
      ...progress,
      lessonsGenerated,
      lessonsFailedValidation,
      lessonsTotal: generateCandidates.length,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(6)),
    },
  });

  await getGenerationQueue().add("commit", job.data);
}

async function handleCommit(job: Job<GenerationJobData, void, GenerationJobName>) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);
  const stageProgress = readJson<Record<string, any>>(record.stage_progress, {});
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
  logger.info(`Generation job ${generationJobId} committed via manifest ${manifestId}`, {
    manifestStatus: result?.status,
  });
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
