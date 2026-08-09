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
  resolveManifestCandidateAgainstExisting,
} from "../services/in-app-generation.service";
import { parseSource, SourceType } from "../services/document-parser.service";
import {
  enumerateCandidates,
  SourceLocator,
} from "../services/extraction-foundation.service";
import { database } from "../utils/db";
import { logger } from "../utils/logger";
import { readJson } from "../utils/json";
import { readFile } from "fs/promises";
import { removeStagedUpload } from "../services/staged-upload.service";
import {
  classifyProviderFailure,
  ProviderRequestError,
} from "../services/provider-reliability";
import { ProviderNeutralJobRepository } from "../services/provider-neutral-job.repository";
import { configFor } from "../services/ai-provider.service";
import {
  buildGeminiLessonBatchRequest,
  getGeminiBatch,
  parseGeminiLessonBatchResponse,
  reconcileGeminiBatchResults,
  resolveGenerationExecutionMode,
  submitGeminiBatch,
} from "../services/gemini-batch.service";
import { calculateGeminiCost, GEMINI_PRICING_VERSION } from "../services/gemini-cost-optimization.service";
import {
  pendingPlanMembers,
  reconstructDurableBatches,
} from "../services/durable-generation-plan";
import {
  GENERATION_WORKER_HEALTH_KEY,
  GENERATION_WORKER_HEALTH_TTL_SECONDS,
} from "./worker-health";

const jobService = new GenerationJobService(database);

async function assertNotCancelled(jobId: string) {
  const row = await database("generation_jobs")
    .where({ id: jobId })
    .select("cancellation_requested_at")
    .first();
  if (row?.cancellation_requested_at)
    throw new ProviderRequestError(
      "cancelled",
      "Generation was cancelled by the user",
      false,
    );
}

function cancellationSignal(jobId: string) {
  const controller = new AbortController();
  const timer = setInterval(async () => {
    const row = await database("generation_jobs")
      .where({ id: jobId })
      .select("cancellation_requested_at")
      .first();
    if (row?.cancellation_requested_at) controller.abort();
  }, 500);
  timer.unref();
  return { signal: controller.signal, dispose: () => clearInterval(timer) };
}

async function handleExtract(
  job: Job<GenerationJobData, void, GenerationJobName>,
) {
  const { generationJobId, userId } = job.data;
  const record = await jobService.get(userId, generationJobId);
  await assertNotCancelled(generationJobId);
  if (record.staged_upload_parsed_at) {
    const durableChunk = await database("generation_job_segments")
      .where({ generation_job_id: generationJobId })
      .andWhere("sequence_number", ">", 0)
      .first();
    if (durableChunk) {
      await getGenerationQueue().add("assess", job.data, {
        jobId: generationStageJobId(generationJobId, "assess"),
      });
      return;
    }
  }
  const stagedSource = await database("generation_job_segments")
    .where({ generation_job_id: generationJobId, sequence_number: 0 })
    .first();
  if (!stagedSource?.original_text && !record.staged_upload_path) {
    throw new Error("Durable staged source is missing -- cannot extract.");
  }

  await jobService.updateStatus(generationJobId, "extracting", {
    stageProgress: { chunksTotal: 0, chunksProcessed: 0 },
  });

  const stagedBuffer = record.staged_upload_path
    ? await readFile(record.staged_upload_path)
    : null;
  const sourceContent = stagedBuffer
    ? record.source_type === "text"
      ? stagedBuffer.toString("utf8")
      : stagedBuffer.toString("base64")
    : stagedSource.original_text;
  const parsedSegments = await parseSource(
    record.source_type as SourceType,
    sourceContent,
  );
  const unreadable = parsedSegments.filter(
    (segment) => segment.status === "unreadable",
  );
  const chunks = parsedSegments.filter(
    (segment) => segment.status === "readable",
  );

  await database.transaction(async (trx: any) => {
    if (chunks.length) {
      await trx("generation_job_segments")
        .insert(
          chunks.map((segment, index) => ({
            generation_job_id: generationJobId,
            sequence_number: index + 1,
            content_hash: segment.contentHash,
            original_text: segment.originalText,
            normalized_text: segment.normalizedText,
            locator: JSON.stringify(segment.locator),
            status: "extracted",
          })),
        )
        .onConflict(["generation_job_id", "sequence_number"])
        .ignore();
    }
    if (unreadable.length) {
      await trx("generation_job_events").insert({
        generation_job_id: generationJobId,
        event_type: "source_attention_required",
        stage: "extract",
        details: JSON.stringify({
          units: unreadable.map((segment) => ({
            locator: segment.locator,
            error: segment.error,
          })),
        }),
      });
    }
    if (record.staged_upload_path) {
      await trx("generation_jobs").where({ id: generationJobId }).update({
        staged_upload_parsed_at: new Date(),
        staged_upload_path: null,
      });
    }
  });
  if (record.staged_upload_path)
    await removeStagedUpload(record.staged_upload_path);

  if (unreadable.length) {
    await jobService.updateStatus(generationJobId, "attention_required", {
      stageProgress: {
        chunksTotal: parsedSegments.length,
        chunksProcessed: chunks.length,
        unreadableUnits: unreadable.length,
      },
    });
    return;
  }

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
  await assertNotCancelled(generationJobId);
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
  const deterministic = enumerateCandidates(
    segmentRows.map((row: any, index: number) => ({
      segmentId: row.id,
      sequence: index + 1,
      originalText: row.original_text || "",
      normalizedText: row.normalized_text || "",
      locator: readJson(row.locator, {
        unit: "document",
        unitIndex: index + 1,
        startOffset: 0,
        endOffset: String(row.original_text || "").length,
      }),
      status: "readable" as const,
      contentHash: row.content_hash,
    })),
  );
  const chunkIds = chunks.map(
    (_, i) => `chunk-${String(i + 1).padStart(4, "0")}`,
  );

  // Cloud calls are bounded to avoid rate limits; local calls are kept
  // sequential because long Ollama generations compete for the same memory.
  // A 30-chunk document with Promise.all would fire 30 simultaneous requests.
  const provider = record.provider === "ollama" ? "ollama" : "gemini";
  const limit = pLimit(provider === "ollama" ? 1 : 5);
  const rawCandidatesPerChunk = await Promise.all(
    chunks.map((chunk, index) =>
      limit(async () => {
        await assertNotCancelled(generationJobId);
        const segmentId = segmentRows[index].id;
        return assessChunk(
          chunk,
          chunkIds[index],
          undefined,
          deterministic
            .filter((candidate) =>
              candidate.occurrences.some(
                (occurrence) => occurrence.segmentId === segmentId,
              ),
            )
            .map((candidate) => ({
              candidateId: candidate.candidateId,
              term: candidate.baseForm,
              itemType: candidate.itemType,
            })),
          provider,
        );
      }),
    ),
  );

  const segmentLocators = segmentRows.map((row: any, index: number) =>
    readJson(row.locator, {
      unit: "document",
      unitIndex: index + 1,
      startOffset: 0,
      endOffset: String(row.original_text || "").length,
    }),
  ) as SourceLocator[];
  const pageForSegment = (index: number) =>
    Number(segmentLocators[index]?.page || index + 1);
  const unmergedManifestCandidates = rawCandidatesPerChunk.flatMap(
    (rawCandidates, chunkIndex) => {
      const segmentId = segmentRows[chunkIndex].id;
      return rawCandidates.map((raw) => {
        const sourceCandidate = deterministic.find(
          (candidate) => candidate.candidateId === raw.candidateId,
        );
        const occurrences = (sourceCandidate?.occurrences || [])
          .filter((occurrence) => occurrence.segmentId === segmentId)
          .map((occurrence) => ({
            page: Number(occurrence.locator.page || pageForSegment(chunkIndex)),
            chunkId: chunkIds[chunkIndex],
            sentence: occurrence.sentence,
          }));
        return toManifestCandidate(
          raw,
          chunkIds[chunkIndex],
          pageForSegment(chunkIndex),
          occurrences.length
            ? occurrences
            : [{
                page: pageForSegment(chunkIndex),
                chunkId: chunkIds[chunkIndex],
                sentence: raw.sourceSentence,
              }],
        );
      });
    },
  );
  const mergedCandidates = new Map<string, any>();
  for (const candidate of unmergedManifestCandidates) {
    const key =
      `${candidate.term.normalize("NFKC").toLowerCase()}\u0000${"senseKey" in candidate ? candidate.senseKey : candidate.contextualMeaning || candidate.term}`;
    const current = mergedCandidates.get(key);
    if (!current) {
      mergedCandidates.set(key, candidate);
      continue;
    }
    const seen = new Set(
      current.occurrences.map(
        (occurrence: any) =>
          `${occurrence.page}\u0000${occurrence.chunkId}\u0000${occurrence.sentence}`,
      ),
    );
    for (const occurrence of candidate.occurrences) {
      const occurrenceKey =
        `${occurrence.page}\u0000${occurrence.chunkId}\u0000${occurrence.sentence}`;
      if (!seen.has(occurrenceKey)) {
        current.occurrences.push(occurrence);
        seen.add(occurrenceKey);
      }
    }
  }

  const normalizedTerms = [
    ...new Set(
      [...mergedCandidates.values()].map((candidate: any) =>
        candidate.term.normalize("NFKC").trim().replace(/\\s+/g, " ").toLowerCase(),
      ),
    ),
  ];
  const existingSenses = normalizedTerms.length
    ? await database("vocabulary_words")
        .where({ owner_user_id: userId })
        .whereIn("normalized_term", normalizedTerms)
        .select(
          "id",
          "word",
          "normalized_term",
          "sense_rank",
          "sense_key",
          "sense_gloss",
          "english_meaning",
        )
    : [];
  const manifestCandidates = [...mergedCandidates.values()].map((candidate) =>
    resolveManifestCandidateAgainstExisting(candidate, existingSenses),
  ) as typeof unmergedManifestCandidates;

  const totalPages = Math.max(1, ...segmentLocators.map((_: any, index: number) =>
    pageForSegment(index),
  ));
  const pages = Array.from({ length: totalPages }, (_, index) => {
    const page = index + 1;
    return {
      page,
      status: "assessed" as const,
      chunkIds: chunkIds.filter((_, chunkIndex) => pageForSegment(chunkIndex) === page),
    };
  });
  const coverageChunks = chunkIds.map((chunkId, index) => {
    const page = pageForSegment(index);
    return {
      chunkId,
      pageStart: page,
      pageEnd: page,
      status: "assessed" as const,
      candidateIds: manifestCandidates
        .filter((candidate: any) =>
          candidate.occurrences.some((occurrence: any) => occurrence.chunkId === chunkId),
        )
        .map((candidate: any) => candidate.candidateId),
    };
  });

  const manifestId = `inapp-${generationJobId}`;
  const manifestDoc = buildManifestDocument({
    manifestId,
    sourceName: record.source_name,
    sourceType: record.source_type,
    contentHash: record.source_hash,
    totalPages,
    candidates: manifestCandidates,
    pages,
    chunks: coverageChunks,
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
  const ingestResult = await contentPackService.ingestDocuments(
    [
      {
        path: `inapp/${manifestId}/manifest.json`,
        content: JSON.stringify(manifestDoc),
      },
    ],
    { inboxBranch: "inapp" },
  );
  if (ingestResult.errors.length) {
    throw new Error(
      `Manifest ingestion failed: ${ingestResult.errors
        .map((e) => e.message)
        .join("; ")}`,
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
  const attentionCount = manifestDoc.candidates.filter(
    (candidate: any) =>
      candidate.senseDecision === "ambiguous" ||
      candidate.taxonomy?.confidence === "low",
  ).length;
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
            status: attentionCount ? "attention_required" : "generating",
            stage_progress: JSON.stringify({
              ...durableProgress,
              attentionCount,
            }),
            updated_at: new Date(),
          });
        await trx("generation_job_events").insert({
          generation_job_id: generationJobId,
          event_type: attentionCount
            ? "job.attention_required"
            : "job.generating",
          stage: attentionCount ? "review" : "generating",
          details: JSON.stringify({ ...durableProgress, attentionCount }),
        });
      }),
    () =>
      attentionCount
        ? Promise.resolve()
        : getGenerationQueue().add("generate", job.data, {
            jobId: generationStageJobId(generationJobId, "generate"),
          }),
  );
}

async function enqueueBatchPoll(data: GenerationJobData) {
  await getGenerationQueue().add("batch-poll", data, {
    jobId: `${data.generationJobId}:batch-poll:${Date.now()}`,
    delay: Number(process.env.GEMINI_BATCH_POLL_INTERVAL_MS || 30_000),
    attempts: 3,
  });
}

async function handleGeminiBatchGeneration(
  job: Job<GenerationJobData, void, GenerationJobName>,
  record: any,
  progress: Record<string, any>,
  plan: any[],
  repository: ProviderNeutralJobRepository,
): Promise<boolean> {
  const pending = plan.filter((item) => !(item.result_id && item.validation_status === "valid"));
  if (!pending.length) return true;
  const config = configFor("primary");

  if (!record.provider_batch_id) {
    const requests = pending.map((member) => {
      const candidate = readJson<any>(member.snapshot, null);
      if (!candidate) throw new Error(`Cannot reconstruct batch candidate ${member.external_candidate_id}.`);
      return buildGeminiLessonBatchRequest({
        candidateId: member.external_candidate_id,
        term: candidate.term,
        contextualMeaning: candidate.contextualMeaning,
        sourceSentence: candidate.senseEvidence?.sentence,
        surroundingContext: candidate.occurrences?.[0]?.sentence,
        cefrLevel: candidate.cefrLevel,
        categoryName: candidate.categoryName,
      });
    });

    // Creation is intentionally called once and never wrapped in the normal
    // provider retry helper because Gemini batch creation is not idempotent.
    let submission;
    try {
      submission = await submitGeminiBatch(
        config,
        `vocabulary-${job.data.generationJobId}-${Date.now()}`,
        requests,
      );
    } catch (error) {
      await jobService.updateStatus(job.data.generationJobId, "attention_required", {
        stageProgress: {
          ...progress,
          executionMode: "batch",
          batchSubmissionUncertain: true,
          exactNextAction: "Check Gemini batches before retrying; creation is not idempotent.",
        },
        errorMessage: (error as Error).message,
      });
      return false;
    }
    await database.transaction(async (trx: any) => {
      await trx("generation_jobs").where({ id: job.data.generationJobId }).update({
        provider_batch_id: submission.name,
        provider_batch_state: submission.state,
        provider_batch_submitted_at: new Date(),
        updated_at: new Date(),
      });
      for (const member of pending) {
        await trx("generation_provider_batch_requests")
          .insert({
            generation_job_id: job.data.generationJobId,
            candidate_decision_id: member.candidate_decision_id,
            external_candidate_id: member.external_candidate_id,
            provider_batch_id: submission.name,
            status: "submitted",
          })
          .onConflict(["generation_job_id", "external_candidate_id"])
          .merge({ provider_batch_id: submission.name, status: "submitted", provider_error: null, updated_at: new Date() });
      }
    });
    await enqueueBatchPoll(job.data);
    return false;
  }

  const batch = await getGeminiBatch(config, record.provider_batch_id);
  await database("generation_jobs").where({ id: job.data.generationJobId }).update({
    provider_batch_state: batch.state,
    provider_batch_polled_at: new Date(),
    updated_at: new Date(),
  });
  if (["BATCH_STATE_PENDING", "BATCH_STATE_RUNNING", "JOB_STATE_PENDING", "JOB_STATE_RUNNING"].includes(batch.state)) {
    await enqueueBatchPoll(job.data);
    return false;
  }
  if (!["BATCH_STATE_SUCCEEDED", "JOB_STATE_SUCCEEDED"].includes(batch.state)) {
    await jobService.updateStatus(job.data.generationJobId, "attention_required", {
      stageProgress: { ...progress, executionMode: "batch", providerBatchState: batch.state },
      errorMessage: `Gemini Batch ended in ${batch.state}.`,
    });
    return false;
  }

  const reconciliation = reconcileGeminiBatchResults(
    pending.map((item) => item.external_candidate_id),
    batch.results,
  );
  for (const item of reconciliation.succeeded) {
    const member = pending.find((row) => row.external_candidate_id === item.candidateId);
    const candidate = readJson<any>(member.snapshot, null);
    try {
      const parsed = parseGeminiLessonBatchResponse({
        candidateId: member.external_candidate_id,
        term: candidate.term,
        contextualMeaning: candidate.contextualMeaning,
        sourceSentence: candidate.senseEvidence?.sentence,
        surroundingContext: candidate.occurrences?.[0]?.sentence,
        cefrLevel: candidate.cefrLevel,
        categoryName: candidate.categoryName,
      }, item.response!);
      const [attempt] = await database("generation_attempts").insert({
        generation_job_id: job.data.generationJobId,
        batch_id: member.batch_id,
        candidate_decision_id: member.candidate_decision_id,
        stage: "generate",
        request_type: "lesson_generation_batch",
        prompt_version: record.prompt_version,
        attempt_number: 1,
        provider: record.provider,
        model: record.provider_model,
        status: "started",
        execution_mode: "batch",
        pricing_version: GEMINI_PRICING_VERSION,
        thinking_tokens: parsed.thinkingTokens,
      }).returning("*");
      await repository.persistValidEntry({
        jobId: job.data.generationJobId,
        candidateDecisionId: member.candidate_decision_id,
        attemptId: attempt.id,
        entry: parsed.entry,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        costUsd: calculateGeminiCost(record.provider_model, { inputTokens: parsed.inputTokens, outputTokens: parsed.outputTokens, cachedTokens: parsed.cachedTokens, thinkingTokens: parsed.thinkingTokens }, "batch"),
        cachedTokens: parsed.cachedTokens,
        latencyMs: 0,
        model: record.provider_model,
      });
      await database("generation_provider_batch_requests")
        .where({ generation_job_id: job.data.generationJobId, external_candidate_id: item.candidateId })
        .update({ status: "succeeded", updated_at: new Date() });
    } catch (error) {
      reconciliation.failed.push({ candidateId: item.candidateId, error: { message: (error as Error).message } });
    }
  }

  const retryIds = new Set([
    ...reconciliation.failed.map((item) => item.candidateId),
    ...reconciliation.missingCandidateIds,
  ]);
  if (retryIds.size) {
    await database.transaction(async (trx: any) => {
      await trx("generation_jobs").where({ id: job.data.generationJobId }).update({
        provider_batch_id: null,
        provider_batch_state: "PARTIAL_RETRY",
        updated_at: new Date(),
      });
      await trx("generation_provider_batch_requests")
        .where({ generation_job_id: job.data.generationJobId })
        .whereIn("external_candidate_id", [...retryIds])
        .update({ status: "retry_pending", updated_at: new Date() });
    });
    await enqueueBatchPoll(job.data);
    return false;
  }
  return true;
}

async function handleGenerate(
  job: Job<GenerationJobData, void, GenerationJobName>,
) {
  const { generationJobId, userId } = job.data;
  await assertNotCancelled(generationJobId);
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

  const resolvedMode = record.execution_mode_resolved ||
    (record.provider === "ollama"
      ? "standard"
      : resolveGenerationExecutionMode(record.execution_mode_requested || "auto", initialPlan.length));
  if (!record.execution_mode_resolved) {
    await database("generation_jobs").where({ id: generationJobId }).update({ execution_mode_resolved: resolvedMode, updated_at: new Date() });
  }
  if (resolvedMode === "batch") {
    const complete = await handleGeminiBatchGeneration(job, { ...record, execution_mode_resolved: resolvedMode }, progress, initialPlan, repository);
    if (!complete) return;
  }

  const durableAttempts = await database("generation_attempts")
    .where({ generation_job_id: generationJobId, status: "succeeded" })
    .select("input_tokens", "output_tokens", "cost_usd");
  let totalInputTokens = durableAttempts.reduce(
    (sum: number, attempt: any) => sum + Number(attempt.input_tokens ?? 0),
    0,
  );
  let totalOutputTokens = durableAttempts.reduce(
    (sum: number, attempt: any) => sum + Number(attempt.output_tokens ?? 0),
    0,
  );
  let totalCostUsd = durableAttempts.reduce(
    (sum: number, attempt: any) => sum + Number(attempt.cost_usd ?? 0),
    0,
  );

  // Generate in immutable batch/position order. A row with result_id is
  // already complete and is never sent to the provider again.
  for (const member of initialPlan) {
    await assertNotCancelled(generationJobId);
    if (member.result_id && member.validation_status === "valid") continue;

    const hardBudget = Number(record.hard_budget_usd || 0);
    const estimatedNextCall = record.provider === "ollama"
      ? 0
      : Number(process.env.GEMINI_ESTIMATED_LESSON_COST_USD || 0.02);
    if (hardBudget > 0 && totalCostUsd + estimatedNextCall > hardBudget) {
      await jobService.updateStatus(generationJobId, "attention_required", {
        stageProgress: {
          ...progress,
          lessonsGenerated: initialPlan.length - pendingPlanMembers(await repository.loadGenerationPlan(generationJobId)).length,
          lessonsTotal: initialPlan.length,
          totalCostUsd: Number(totalCostUsd.toFixed(6)),
          budgetBlocked: true,
          hardBudgetUsd: hardBudget,
        },
      });
      return;
    }

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
        request_type: "lesson_generation",
        prompt_version: record.prompt_version,
        attempt_number: Number(previousAttempts?.count ?? 0) + 1,
        provider: record.provider,
        model: record.provider_model,
        status: "started",
      })
      .returning("*");

    let result: Awaited<ReturnType<typeof generateLessonEntry>>;
    const cancellation = cancellationSignal(generationJobId);
    try {
      result = await generateLessonEntry(
        {
          candidateId: member.external_candidate_id,
          term: candidate.term,
          contextualMeaning: candidate.contextualMeaning,
          sourceSentence: candidate.senseEvidence?.sentence,
          surroundingContext: candidate.occurrences?.[0]?.sentence,
          cefrLevel: candidate.cefrLevel,
          categoryName: candidate.categoryName,
        },
        cancellation.signal,
        record.provider === "ollama" ? "ollama" : "gemini",
      );
    } catch (error) {
      const classified = classifyProviderFailure(error);
      await database("generation_attempts").where({ id: attempt.id }).update({
        status: "failed",
        error_code: classified.code,
        error_message: classified.message,
        completed_at: new Date(),
      });
      throw classified;
    } finally {
      cancellation.dispose();
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
      cachedTokens: result.cachedTokens,
      latencyMs: result.latencyMs,
      model: result.model,
    });
    if (persisted === "inserted") {
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      totalCostUsd += result.estimatedCostUsd;
    }

    const completed = (
      await repository.loadGenerationPlan(generationJobId)
    ).filter(
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
        persisted === "inserted" ? result.inputTokens + result.outputTokens : 0,
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
    { inboxBranch: "inapp" },
  );
  if (ingestResult.errors.length) {
    throw new Error(
      `Batch ingestion failed: ${ingestResult.errors
        .map((e) => e.message)
        .join("; ")}`,
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
  const verification = result?.verification as
    | { verified?: boolean }
    | undefined;

  if (
    result?.status !== "completed" ||
    verification?.verified !== true ||
    Number(result?.generation?.missingBatches || 0) !== 0 ||
    Number(result?.generation?.invalidBatches || 0) !== 0
  ) {
    throw new Error(
      `PostgreSQL commit/read-back did not reconcile for ${manifestId}: ${result?.nextAction || "verification is incomplete"}`,
    );
  }

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
  "batch-poll": handleGenerate,
  commit: handleCommit,
};

export function startGenerationWorker() {
  const concurrency = Number(process.env.GENERATION_WORKER_CONCURRENCY || 2);

  const worker = new Worker<GenerationJobData, void, GenerationJobName>(
    GENERATION_QUEUE_NAME,
    async (job) => {
      await jobService.incrementAttempt(job.data.generationJobId);
      try {
        await handlers[job.name](job);
      } catch (error) {
        const classified = classifyProviderFailure(error);
        if (!classified.retryable) job.discard();
        throw classified;
      }
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
    const classified = classifyProviderFailure(error);
    if (!classified.retryable || job.attemptsMade >= (job.opts.attempts || 1)) {
      const cancelled = classified.code === "cancelled";
      await jobService.updateStatus(
        job.data.generationJobId,
        cancelled ? "cancelled" : "failed",
        {
          errorMessage: classified.message,
        },
      );
      await database("generation_jobs")
        .where({ id: job.data.generationJobId })
        .update({ terminal_reason: classified.code });
      const record = await database("generation_jobs")
        .where({ id: job.data.generationJobId })
        .first();
      if (cancelled) await removeStagedUpload(record?.staged_upload_path);
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
