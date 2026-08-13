import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { execFileSync } from "child_process";
import { Knex } from "knex";
import { AssessmentControlService } from "./assessment-control.service";
import {
  ContentBatch,
  ContentManifest,
  isSenseAwareManifest,
  isTaxonomyAwareManifest,
  parseContentPack,
  validateContentBatch,
  validateContentManifest,
} from "./content-pack-contract";
import {
  DEFAULT_IMPORT_POLICY,
  importPolicySnapshot,
} from "../config/import-policy";
import { VocabularyImportService } from "./vocabulary-import.service";
import {
  allocatePersistentSenseRank,
  lockVocabularyTerm,
  normalizeVocabularyTerm,
  resolveContextualSense,
} from "./vocabulary-sense.service";
import { legacyTaxonomyPath } from "../data/vocabulary-taxonomy";
import { cacheInvalidate } from "../utils/redis";
import { readJson } from "../utils/json";
import { ProviderNeutralJobRepository } from "./provider-neutral-job.repository";
import { planGenerationWaves, PlannedBatch } from "./generation-waves";

const CONTENT_PACK_AUXILIARY_FILES = new Set([
  "pre-manifest-reconciliation.json",
]);

export function isContentPackAuxiliaryDocument(documentPath: string): boolean {
  const normalizedPath = documentPath.replace(/\\/g, "/");
  return CONTENT_PACK_AUXILIARY_FILES.has(path.posix.basename(normalizedPath));
}

export interface ContentPackDocument {
  path: string;
  content: string;
}

export interface ContentPackSyncResult {
  manifestsAdded: number;
  batchesAdded: number;
  unchanged: number;
  committedEntries: number;
  errors: Array<{ path: string; message: string }>;
  cleanupEligible: string[];
  fetchedCommit?: string;
}

export interface ContentPackIngestContext {
  inboxBranch?: string;
  fetchedCommit?: string;
  syncedAt?: Date;
}

export function shouldAutomaticallyApproveManifest(
  row: { owner_user_id?: string | null; status?: string | null },
  approvalRequired: boolean = DEFAULT_IMPORT_POLICY.approvalRequired,
): boolean {
  return Boolean(
    row.owner_user_id &&
    !approvalRequired &&
    row.status === "awaiting_approval",
  );
}

export function recoverAutomaticApprovalCandidateIds(
  proposedCandidateIds: string[],
  existingJobCandidateIds: string[],
): string[] {
  return [
    ...new Set(
      existingJobCandidateIds.length
        ? existingJobCandidateIds
        : proposedCandidateIds,
    ),
  ];
}

export function isSkippableCandidateAttention(message: string): boolean {
  return /^Contextual sense for .+ requires attention: .+/i.test(
    message.trim(),
  );
}

export function buildBatchCheckpoint(
  manifestId: string,
  plannedBatchNumbers: number[],
  receivedBatchNumbers: number[],
  plannedBatches?: readonly PlannedBatch[],
) {
  const received = new Set(receivedBatchNumbers);
  const missingBatchNumbers = plannedBatchNumbers.filter(
    (batchNumber) => !received.has(batchNumber),
  );
  const nextBatchNumber = missingBatchNumbers[0] ?? null;
  const waves = planGenerationWaves(
    plannedBatches ??
      plannedBatchNumbers.map((batchNumber) => ({
        batchNumber,
        candidateIds: [],
      })),
    received,
  );
  const currentWave = waves.find((wave) => !wave.complete) ?? null;
  return {
    state: missingBatchNumbers.length ? "safely_paused" : "all_batches_received",
    receivedBatchNumbers: plannedBatchNumbers.filter((batchNumber) =>
      received.has(batchNumber),
    ),
    missingBatchNumbers,
    nextBatchNumber,
    waves,
    currentWaveNumber: currentWave?.waveNumber ?? null,
    totalWaves: waves.length,
    continuationPrompt: nextBatchNumber
      ? `Drain import ${manifestId} from batch ${nextBatchNumber} through all remaining execution waves without confirmation. Preserve the existing immutable manifest, candidate membership, batch identities and received batches. Validate, deliver and remotely verify each missing internal batch, then continue immediately. Do not rediscover candidates or replace the manifest.`
      : null,
  } as const;
}

function statusError(
  message: string,
  status = 400,
): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function manifestAssessmentCounts(manifest: ContentManifest) {
  const senseAware = isSenseAwareManifest(manifest);
  return {
    candidatesIdentified: manifest.counts.totalCandidates,
    alreadyPresentUnchanged: manifest.counts.existing,
    existingEntriesToUpdate: manifest.candidates.filter((candidate) => {
      if (candidate.decision !== "generate") return false;
      return senseAware
        ? "senseDecision" in candidate &&
            candidate.senseDecision === "same_sense"
        : "operation" in candidate && candidate.operation === "update";
    }).length,
    lowValueFilteredOut: manifest.counts.filtered + manifest.counts.rejected,
    newEntriesProposed: manifest.candidates.filter((candidate) => {
      if (candidate.decision !== "generate") return false;
      return senseAware
        ? "senseDecision" in candidate &&
            candidate.senseDecision === "new_sense"
        : "operation" in candidate && candidate.operation === "new";
    }).length,
    ambiguousSenses: senseAware
      ? manifest.candidates.filter(
          (candidate) => candidate.senseDecision === "ambiguous",
        ).length
      : 0,
    totalEntriesToProcess: manifest.counts.generate,
    heavyUseSelections: manifest.counts.heavyUse,
    mediumUseSelections: manifest.counts.mediumUse,
    totalPages: manifest.source.totalPages,
    assessedPages: manifest.coverage.pages.filter(
      (page) => page.status === "assessed",
    ).length,
    unreadablePages: manifest.coverage.pages.filter(
      (page) => page.status === "unreadable",
    ).length,
    totalChunks: manifest.source.totalChunks,
    assessedChunks: manifest.coverage.chunks.filter(
      (chunk) => chunk.status === "assessed",
    ).length,
    unreadableChunks: manifest.coverage.chunks.filter(
      (chunk) => chunk.status === "unreadable",
    ).length,
    plannedBatches: manifest.generationPlan.batches.length,
  };
}

export class ContentPackService {
  constructor(private readonly database: Knex | any) {}

  async ingestDocuments(
    documents: ContentPackDocument[],
    context: ContentPackIngestContext = {},
  ): Promise<ContentPackSyncResult> {
    const result: ContentPackSyncResult = {
      manifestsAdded: 0,
      batchesAdded: 0,
      unchanged: 0,
      committedEntries: 0,
      errors: [],
      cleanupEligible: [],
      ...(context.fetchedCommit
        ? { fetchedCommit: context.fetchedCommit }
        : {}),
    };
    const importableDocuments = documents.filter(
      (document) => !isContentPackAuxiliaryDocument(document.path),
    );
    const parsed = importableDocuments.map((document) => {
      try {
        return {
          ...document,
          value: parseContentPack(document.content) as any,
        };
      } catch (error) {
        result.errors.push({
          path: document.path,
          message: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    });
    for (const document of parsed.filter(
      (item): item is NonNullable<typeof item> =>
        Boolean(
          item &&
          !item.value?.formatVersion?.includes("manifest") &&
          !item.value?.formatVersion?.includes("batch"),
        ),
    )) {
      result.errors.push({
        path: document.path,
        message: "Unknown or missing content-pack formatVersion.",
      });
    }

    for (const document of parsed.filter(
      (item): item is NonNullable<typeof item> =>
        Boolean(item?.value?.formatVersion?.includes("manifest")),
    )) {
      const validation = validateContentManifest(document.value);
      if (!validation.valid || !validation.value || !validation.hash) {
        result.errors.push({
          path: document.path,
          message: validation.issues.join("; "),
        });
        continue;
      }
      const existing = await this.database("content_pack_manifests")
        .where({ id: validation.value.manifestId })
        .first();
      if (existing) {
        if (existing.manifest_hash !== validation.hash) {
          result.errors.push({
            path: document.path,
            message: "The manifest ID already exists with different content.",
          });
        } else {
          if (context.fetchedCommit) {
            await this.database("content_pack_manifests")
              .where({ id: validation.value.manifestId })
              .update({
                inbox_branch: context.inboxBranch || "chatgpt-content-inbox",
                fetched_commit: context.fetchedCommit,
                last_synced_at: context.syncedAt || new Date(),
                sync_status: "synchronized",
                sync_error: null,
                // The fetched commit is authoritative for the active inbox.
                // If an identical pack is present again, a previous cleanup
                // marker is stale (for example after a guarded push race).
                // Clear it so the owner can verify and retry cleanup instead
                // of silently excluding the pack from processing.
                inbox_cleaned_at: null,
                inbox_cleanup_commit: null,
                updated_at: new Date(),
              });
          }
          result.unchanged += 1;
        }
        continue;
      }
      await this.database("content_pack_manifests").insert({
        id: validation.value.manifestId,
        manifest_hash: validation.hash,
        source_name: validation.value.source.name,
        source_type: validation.value.source.type,
        status: "unclaimed",
        counts: JSON.stringify(manifestAssessmentCounts(validation.value)),
        payload: JSON.stringify(validation.value),
        validation_report: JSON.stringify({ issues: [] }),
        inbox_branch: context.inboxBranch || "chatgpt-content-inbox",
        fetched_commit: context.fetchedCommit || null,
        last_synced_at: context.syncedAt || new Date(),
        sync_status: "synchronized",
        sync_error: null,
        created_at: new Date(validation.value.createdAt),
        updated_at: new Date(),
      });
      result.manifestsAdded += 1;
    }

    for (const document of parsed.filter(
      (item): item is NonNullable<typeof item> =>
        Boolean(item?.value?.formatVersion?.includes("batch")),
    )) {
      const basicValidation = validateContentBatch(document.value);
      if (!basicValidation.value) {
        result.errors.push({
          path: document.path,
          message: basicValidation.issues.join("; "),
        });
        continue;
      }
      const manifestRow = await this.database("content_pack_manifests")
        .where({ id: basicValidation.value.manifestId })
        .first();
      if (!manifestRow) {
        result.errors.push({
          path: document.path,
          message: `Manifest ${basicValidation.value.manifestId} is missing.`,
        });
        continue;
      }
      const manifest = readJson<ContentManifest>(
        manifestRow.payload,
        null as any,
      );
      const validation = validateContentBatch(document.value, manifest);
      const contentHash = validation.hash || basicValidation.hash!;
      const existing = await this.database("content_pack_batches")
        .where({ id: basicValidation.value.batchId })
        .first();
      if (existing) {
        if (existing.content_hash !== contentHash) {
          result.errors.push({
            path: document.path,
            message: "The batch ID already exists with different content.",
          });
        } else if (existing.status === "invalid") {
          // Invalid is a validator result, not an immutable-content terminal
          // state. Revalidate identical receipts so a batch rejected by an
          // older validator can advance after the production validator is
          // corrected, without changing its batch ID or content hash.
          if (validation.valid) {
            await this.database("content_pack_batches")
              .where({ id: existing.id })
              .update({
                status: "staged",
                manifest_hash: basicValidation.value.manifestHash,
                entry_count: basicValidation.value.entries.length,
                payload: JSON.stringify(
                  validation.value || basicValidation.value,
                ),
                validation_report: JSON.stringify({ issues: [] }),
                updated_at: new Date(),
              });
            result.batchesAdded += 1;
          } else {
            await this.database("content_pack_batches")
              .where({ id: existing.id })
              .update({
                validation_report: JSON.stringify({
                  issues: validation.issues,
                }),
                updated_at: new Date(),
              });
            result.errors.push({
              path: document.path,
              message: validation.issues.join("; "),
            });
          }
        } else {
          result.unchanged += 1;
        }
        continue;
      }
      const occupiedPlanSlot = await this.database("content_pack_batches")
        .where({
          manifest_id: basicValidation.value.manifestId,
          batch_number: basicValidation.value.batchNumber,
        })
        .first();
      if (occupiedPlanSlot) {
        result.errors.push({
          path: document.path,
          message:
            "A different batch already occupies this planned batch number.",
        });
        continue;
      }
      const status = validation.valid ? "staged" : "invalid";
      await this.database("content_pack_batches").insert({
        id: basicValidation.value.batchId,
        manifest_id: basicValidation.value.manifestId,
        batch_number: basicValidation.value.batchNumber,
        content_hash: contentHash,
        manifest_hash: basicValidation.value.manifestHash,
        status,
        entry_count: basicValidation.value.entries.length,
        payload: JSON.stringify(basicValidation.value),
        validation_report: JSON.stringify({ issues: validation.issues }),
        created_at: new Date(basicValidation.value.createdAt),
        updated_at: new Date(),
      });
      result.batchesAdded += 1;
      if (!validation.valid) {
        result.errors.push({
          path: document.path,
          message: validation.issues.join("; "),
        });
      }
    }

    await this.recordIngestErrors(
      result.errors,
      importableDocuments,
      parsed,
      context,
    );

    // Ingestion is deliberately account-neutral: it only discovers, validates,
    // and stages immutable files. Claiming, committing, read-back verification,
    // and cleanup must run through the authenticated processing request. This
    // prevents a background/control sync from processing another local
    // account's manifest and removes the stage/process cleanup race.
    return result;
  }

  async listManifests(userId: string) {
    const rows = await this.database("content_pack_manifests")
      .where({ inbox_branch: "chatgpt-content-inbox" })
      .where((builder: any) =>
        builder.whereNull("owner_user_id").orWhere("owner_user_id", userId),
      )
      // The ledger is a recovery queue, not an import-history screen. Once a
      // verified pack has been removed from the inbox there is no action left
      // for the learner, so keep it out of the active list.
      // This is an action queue, never history. Completed imports disappear
      // immediately; inbox cleanup continues independently and idempotently.
      .whereNot("status", "completed")
      .orderBy("created_at", "desc");
    return Promise.all(rows.map((row: any) => this.manifestSummary(row)));
  }

  async listIngestErrors() {
    return (
      this.database("content_pack_ingest_errors")
        .where({ status: "active" })
        // Internal Gemini/Ollama transactions share validation storage but are
        // never ChatGPT inbox documents. Keep their diagnostics in the provider
        // workflow that created them instead of presenting them as packs that
        // ChatGPT must correct.
        .whereNot("document_path", "like", "inapp/%")
        .orderBy("updated_at", "desc")
        .select(
          "document_path",
          "pack_id",
          "issues",
          "created_at",
          "updated_at",
        )
    );
  }

  async processAvailableManifests(userId: string) {
    const inaccessible = await this.database("content_pack_manifests")
      .where({ inbox_branch: "chatgpt-content-inbox" })
      .whereNotNull("owner_user_id")
      .whereNot({ owner_user_id: userId })
      .whereNull("inbox_cleaned_at")
      .select("id");
    const rows = await this.database("content_pack_manifests")
      .where({ inbox_branch: "chatgpt-content-inbox" })
      .where((builder: any) =>
        builder.whereNull("owner_user_id").orWhere("owner_user_id", userId),
      )
      .whereNull("inbox_cleaned_at")
      .orderBy("created_at", "asc")
      .select("id", "owner_user_id", "status");
    const processed: string[] = [];
    const cleanupEligible: string[] = [];
    const failures: Array<{
      manifestId: string;
      message: string;
      retryable: boolean;
    }> = [];
    const skippedItems: Array<{
      manifestId: string;
      term: string;
      reason: string;
    }> = [];
    for (const row of rows) {
      try {
        if (!row.owner_user_id) {
          await this.claimManifest(userId, row.id);
        } else if (shouldAutomaticallyApproveManifest(row)) {
          // Re-resolve stale attention rows before promoting an import created by
          // the retired workflow. Stored vocabulary may prove that a staged
          // "new" candidate is actually an already-complete contextual sense.
          await this.reconcileLegacySenseAttention(userId, row.id);
          await this.approveManifest(userId, row.id);
        } else {
          await this.commitAvailableBatches(userId, row.id);
        }
        const verification = await this.verifyManifest(userId, row.id);
        const skipped = await this.database(
          "assessment_candidates as candidates",
        )
          .join(
            "content_pack_manifests as manifests",
            "manifests.assessment_run_id",
            "candidates.assessment_run_id",
          )
          .where({ "manifests.id": row.id, "candidates.status": "skipped" })
          .select("candidates.item", "candidates.decision_reason");
        skippedItems.push(
          ...skipped.map((item: any) => ({
            manifestId: row.id,
            term: item.item,
            reason:
              item.decision_reason ||
              "The candidate could not be imported safely.",
          })),
        );
        processed.push(row.id);
        if (verification.verified) cleanupEligible.push(row.id);
        await this.database("content_pack_manifests")
          .where({ id: row.id })
          .update({
            sync_status: "synchronized",
            sync_error: null,
            updated_at: new Date(),
          });
      } catch (error) {
        const failure = error as Error & { status?: number };
        const message =
          failure instanceof Error
            ? failure.message
            : "Automatic import reconciliation failed.";
        const retryable = !failure.status || failure.status >= 500;
        failures.push({ manifestId: row.id, message, retryable });
        await this.database("content_pack_manifests")
          .where({ id: row.id })
          .update({
            sync_status: retryable ? "retry_pending" : "attention_required",
            sync_error: message,
            updated_at: new Date(),
          });
      }
    }
    return {
      processed,
      cleanupEligible,
      failures,
      skippedItems,
      blockedByAccount: inaccessible.map((row: any) => row.id),
    };
  }

  async getManifest(userId: string, manifestId: string) {
    const row = await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .where((builder: any) =>
        builder.whereNull("owner_user_id").orWhere("owner_user_id", userId),
      )
      .first();
    if (!row) throw statusError("ChatGPT content manifest not found", 404);
    const summary = await this.manifestSummary(row);
    const candidates = row.assessment_run_id
      ? await this.database("assessment_candidates")
          .where({ assessment_run_id: row.assessment_run_id })
          .orderBy("created_at")
      : [];
    const batches = await this.database("content_pack_batches")
      .where({ manifest_id: manifestId })
      .orderBy("batch_number");
    return { ...summary, candidates, batches };
  }

  async claimManifest(userId: string, manifestId: string) {
    await this.database.transaction(async (trx: any) => {
      const row = await trx("content_pack_manifests")
        .where({ id: manifestId })
        .forUpdate()
        .first();
      if (!row) throw statusError("ChatGPT content manifest not found", 404);
      if (row.owner_user_id && row.owner_user_id !== userId) {
        throw statusError("This manifest belongs to another account", 403);
      }
      if (row.owner_user_id) return;
      const manifest = readJson<ContentManifest>(row.payload, null as any);
      const validation = validateContentManifest(manifest);
      if (!validation.valid) {
        throw statusError(
          `Manifest validation failed: ${validation.issues.join("; ")}`,
        );
      }

      let source = await trx("content_sources")
        .where({
          owner_user_id: userId,
          content_hash: manifest.source.contentHash,
        })
        .first();
      if (!source) {
        [source] = await trx("content_sources")
          .insert({
            owner_user_id: userId,
            source_type: manifest.source.type,
            name: manifest.source.name,
            content_hash: manifest.source.contentHash,
            metadata: JSON.stringify({
              transport: row.inbox_branch || "chatgpt-content-inbox",
              manifestId,
              coverage: manifest.coverage,
            }),
          })
          .returning("*");
      }

      const counts = manifestAssessmentCounts(manifest);
      const initialStatus =
        counts.unreadablePages || counts.unreadableChunks
          ? "attention_required"
          : counts.totalEntriesToProcess === 0 && counts.ambiguousSenses > 0
            ? "attention_required"
            : counts.totalEntriesToProcess === 0
              ? "completed"
              : "assessed";
      const [run] = await trx("assessment_runs")
        .insert({
          owner_user_id: userId,
          source_id: source.id,
          operation_id: `content-pack:${manifestId}`,
          request_hash: row.manifest_hash,
          status: initialStatus,
          counts: JSON.stringify(counts),
          import_policy: JSON.stringify(importPolicySnapshot()),
          ...(initialStatus === "completed"
            ? { completed_at: new Date() }
            : {}),
        })
        .returning("*");

      const segmentByExternalId = new Map<string, string>();
      for (const [index, chunk] of manifest.coverage.chunks.entries()) {
        let [segment] = await trx("source_segments")
          .insert({
            source_id: source.id,
            sequence_number: index + 1,
            content: null,
            locator: JSON.stringify({
              chunkId: chunk.chunkId,
              pageStart: chunk.pageStart,
              pageEnd: chunk.pageEnd,
              status: chunk.status,
              error: chunk.error,
            }),
          })
          .onConflict(["source_id", "sequence_number"])
          .ignore()
          .returning("*");
        if (!segment) {
          segment = await trx("source_segments")
            .where({ source_id: source.id, sequence_number: index + 1 })
            .first();
        }
        if (segment) segmentByExternalId.set(chunk.chunkId, segment.id);
      }

      let resolvedSenseAttention = 0;
      let resolvedProcessableCount = 0;
      for (const candidate of manifest.candidates) {
        const processable = candidate.decision === "generate";
        let existing: any;
        let action: string;
        let candidateStatus: string;
        let decisionReason = candidate.reason;
        let senseDecision: string | null = null;
        let senseKey: string | null = null;
        let senseEvidence: unknown = null;
        let allocatedSenseRank: number | null = null;
        const taxonomy =
          candidate.decision === "generate"
            ? isTaxonomyAwareManifest(manifest) &&
              "taxonomy" in candidate &&
              candidate.taxonomy
              ? candidate.taxonomy
              : legacyTaxonomyPath(candidate.categoryName)
            : null;

        if (isSenseAwareManifest(manifest) && "senseDecision" in candidate) {
          const normalizedTerm = normalizeVocabularyTerm(candidate.term);
          await lockVocabularyTerm(trx, userId, normalizedTerm);
          const existingSenses = await trx("vocabulary_words")
            .where({
              owner_user_id: userId,
              normalized_term: normalizedTerm,
            })
            .select(
              "id",
              "word",
              "normalized_term",
              "sense_rank",
              "sense_key",
              "sense_gloss",
              "english_meaning",
            );
          const resolution = resolveContextualSense(
            {
              term: candidate.term,
              contextualMeaning: candidate.contextualMeaning,
              senseKey: candidate.senseKey,
              declaredDecision: candidate.senseDecision,
              matchedWordId: candidate.matchedWordId,
            },
            existingSenses,
          );
          senseDecision = resolution.decision;
          senseKey = candidate.senseKey;
          senseEvidence = candidate.senseEvidence;
          decisionReason = candidate.reason || resolution.reason;
          existing =
            resolution.decision === "same_sense"
              ? resolution.matchedSense
              : undefined;
          if (resolution.decision === "same_sense") {
            allocatedSenseRank = Number(
              resolution.matchedSense.sense_rank || 1,
            );
          } else if (resolution.decision === "new_sense" && processable) {
            allocatedSenseRank = await allocatePersistentSenseRank(
              trx,
              userId,
              normalizedTerm,
            );
          }

          if (resolution.decision === "ambiguous") {
            action = "filtered";
            candidateStatus = "manual_review";
            resolvedSenseAttention += 1;
          } else if (processable) {
            action = resolution.decision === "same_sense" ? "update" : "new";
            candidateStatus = "proposed";
          } else if (candidate.decision === "existing") {
            if (resolution.decision !== "same_sense") {
              action = "filtered";
              candidateStatus = "manual_review";
              resolvedSenseAttention += 1;
            } else {
              action = "unchanged";
              candidateStatus = "unchanged";
            }
          } else {
            action = "filtered";
            candidateStatus = candidate.decision;
          }
        } else {
          existing = await trx("vocabulary_words")
            .where((builder: any) =>
              builder
                .where("owner_user_id", userId)
                .orWhereNull("owner_user_id"),
            )
            .whereRaw("LOWER(word) = LOWER(?)", [candidate.term])
            .first();
          action = processable
            ? existing
              ? "update"
              : "new"
            : candidate.decision === "existing"
              ? "unchanged"
              : "filtered";
          candidateStatus = processable
            ? "proposed"
            : candidate.decision === "existing"
              ? "unchanged"
              : candidate.decision;
        }
        const firstOccurrence = candidate.occurrences[0];
        if (candidateStatus === "proposed") resolvedProcessableCount += 1;
        await trx("assessment_candidates").insert({
          assessment_run_id: run.id,
          source_segment_id: segmentByExternalId.get(firstOccurrence.chunkId),
          matched_word_id: existing?.id,
          external_candidate_id: candidate.candidateId,
          action,
          item: candidate.term,
          base_form: candidate.baseForm,
          item_type: candidate.itemType,
          cefr_level: candidate.cefrLevel,
          usage_frequency: candidate.usageFrequency,
          fluency_value: candidate.fluencyValue,
          learning_priority:
            candidate.usageFrequency === "heavy" ? "high" : "medium",
          contextual_meaning: candidate.contextualMeaning,
          sense_decision: senseDecision,
          sense_key: senseKey,
          sense_evidence: senseEvidence ? JSON.stringify(senseEvidence) : null,
          allocated_sense_rank: allocatedSenseRank,
          taxonomy_version: taxonomy?.taxonomyVersion || null,
          taxonomy_domain_key: taxonomy?.domainKey || null,
          taxonomy_usage_group_key: taxonomy?.usageGroupKey || null,
          taxonomy_category_key: taxonomy?.categoryKey || null,
          taxonomy_confidence:
            taxonomy && "confidence" in taxonomy
              ? taxonomy.confidence
              : taxonomy
                ? "medium"
                : null,
          taxonomy_reason:
            taxonomy && "reason" in taxonomy
              ? taxonomy.reason || null
              : taxonomy
                ? "Assigned from the legacy broad category during compatibility import."
                : null,
          original_sentence: firstOccurrence.sentence,
          proposed_categories: candidate.categoryName
            ? JSON.stringify([
                { name: candidate.categoryName, relationship: "primary" },
              ])
            : "[]",
          status: candidateStatus,
          filter_reason:
            candidateStatus === "manual_review"
              ? decisionReason
              : candidate.reason,
          occurrence_count: candidate.occurrences.length,
          source_locations: JSON.stringify(candidate.occurrences),
          decision_reason: decisionReason,
        });
      }

      const effectiveCounts = {
        ...counts,
        ambiguousSenses: Math.max(
          counts.ambiguousSenses,
          resolvedSenseAttention,
        ),
      };
      const effectiveStatus =
        counts.unreadablePages || counts.unreadableChunks
          ? "attention_required"
          : resolvedProcessableCount === 0 &&
              effectiveCounts.ambiguousSenses > 0
            ? "attention_required"
            : resolvedProcessableCount === 0
              ? "completed"
              : "assessed";
      await trx("assessment_runs")
        .where({ id: run.id })
        .update({
          status: effectiveStatus,
          counts: JSON.stringify(effectiveCounts),
          completed_at: effectiveStatus === "completed" ? new Date() : null,
          updated_at: new Date(),
        });

      await trx("content_pack_manifests")
        .where({ id: manifestId })
        .update({
          owner_user_id: userId,
          source_id: source.id,
          assessment_run_id: run.id,
          counts: JSON.stringify(effectiveCounts),
          status:
            effectiveStatus === "assessed"
              ? "awaiting_approval"
              : effectiveStatus,
          claimed_at: new Date(),
          ...(effectiveStatus === "completed"
            ? { completed_at: new Date() }
            : {}),
          updated_at: new Date(),
        });
      await trx("control_audit_events").insert({
        owner_user_id: userId,
        operation_id: `content-pack:${manifestId}:claim`,
        event_type: "content_pack.claimed",
        entity_type: "assessment_run",
        entity_id: run.id,
        details: JSON.stringify({
          manifestHash: row.manifest_hash,
          counts: effectiveCounts,
        }),
      });
    });
    const claimed = await this.getManifest(userId, manifestId);
    if (
      !DEFAULT_IMPORT_POLICY.approvalRequired &&
      claimed.status === "awaiting_approval"
    ) {
      return this.approveManifest(userId, manifestId);
    }
    return claimed;
  }

  private async reconcileLegacySenseAttention(
    userId: string,
    manifestId: string,
  ) {
    await this.database.transaction(async (trx: any) => {
      const manifestRow = await trx("content_pack_manifests")
        .where({ id: manifestId, owner_user_id: userId })
        .forUpdate()
        .first();
      if (!manifestRow?.assessment_run_id) return;

      const manifest = readJson<ContentManifest>(
        manifestRow.payload,
        null as any,
      );
      if (!isSenseAwareManifest(manifest)) return;
      const manifestCandidates = new Map(
        manifest.candidates.map((candidate: any) => [
          candidate.candidateId,
          candidate,
        ]),
      );
      const attentionRows = await trx("assessment_candidates").where({
        assessment_run_id: manifestRow.assessment_run_id,
        status: "manual_review",
      });

      for (const attentionRow of attentionRows) {
        const candidate: any = manifestCandidates.get(
          attentionRow.external_candidate_id,
        );
        if (
          !candidate ||
          candidate.decision !== "generate" ||
          !("senseDecision" in candidate)
        ) {
          continue;
        }

        const normalizedTerm = normalizeVocabularyTerm(candidate.term);
        await lockVocabularyTerm(trx, userId, normalizedTerm);
        const existingSenses = await trx("vocabulary_words")
          .where({
            owner_user_id: userId,
            normalized_term: normalizedTerm,
          })
          .select(
            "id",
            "word",
            "normalized_term",
            "sense_rank",
            "sense_key",
            "sense_gloss",
            "english_meaning",
          );
        const resolution = resolveContextualSense(
          {
            term: candidate.term,
            contextualMeaning: candidate.contextualMeaning,
            senseKey: candidate.senseKey,
            declaredDecision: candidate.senseDecision,
            matchedWordId: candidate.matchedWordId,
          },
          existingSenses,
        );

        if (resolution.decision === "same_sense") {
          await trx("assessment_candidates")
            .where({ id: attentionRow.id })
            .update({
              action: "unchanged",
              status: "unchanged",
              matched_word_id: resolution.matchedSense.id,
              allocated_sense_rank: Number(
                resolution.matchedSense.sense_rank || 1,
              ),
              sense_decision: "same_sense",
              filter_reason: null,
              decision_reason: resolution.reason,
              updated_at: new Date(),
            });
        } else if (resolution.decision === "new_sense") {
          const allocatedSenseRank = await allocatePersistentSenseRank(
            trx,
            userId,
            normalizedTerm,
          );
          await trx("assessment_candidates")
            .where({ id: attentionRow.id })
            .update({
              action: "new",
              status: "proposed",
              matched_word_id: null,
              allocated_sense_rank: allocatedSenseRank,
              sense_decision: "new_sense",
              filter_reason: null,
              decision_reason: resolution.reason,
              updated_at: new Date(),
            });
        }
      }

      const candidateRows = await trx("assessment_candidates").where({
        assessment_run_id: manifestRow.assessment_run_id,
      });
      const ambiguousSenses = candidateRows.filter(
        (candidate: any) => candidate.status === "manual_review",
      ).length;
      const totalEntriesToProcess = candidateRows.filter(
        (candidate: any) => candidate.status === "proposed",
      ).length;
      const alreadyPresentUnchanged = candidateRows.filter(
        (candidate: any) => candidate.status === "unchanged",
      ).length;
      const existingEntriesToUpdate = candidateRows.filter(
        (candidate: any) =>
          candidate.status === "proposed" && candidate.action === "update",
      ).length;
      const newEntriesProposed = candidateRows.filter(
        (candidate: any) =>
          candidate.status === "proposed" && candidate.action === "new",
      ).length;
      const counts = {
        ...readJson(manifestRow.counts, {}),
        ambiguousSenses,
        totalEntriesToProcess,
        alreadyPresentUnchanged,
        existingEntriesToUpdate,
        newEntriesProposed,
      };
      await trx("assessment_runs")
        .where({ id: manifestRow.assessment_run_id })
        .update({ counts: JSON.stringify(counts), updated_at: new Date() });
      await trx("content_pack_manifests")
        .where({ id: manifestId })
        .update({ counts: JSON.stringify(counts), updated_at: new Date() });
    });
  }

  async approveManifest(
    userId: string,
    manifestId: string,
    externalCandidateIds?: string[],
  ) {
    const row = await this.database("content_pack_manifests")
      .where({ id: manifestId, owner_user_id: userId })
      .first();
    if (!row)
      throw statusError(
        "The automatic import is not owned by this account",
        404,
      );
    if (row.status === "attention_required") {
      throw statusError(
        "Unreadable pages or chunks must be resolved before automatic import.",
      );
    }

    const proposedCandidates = await this.database("assessment_candidates")
      .where({ assessment_run_id: row.assessment_run_id, status: "proposed" })
      .whereIn("action", ["new", "update"])
      .modify((builder: any) => {
        if (externalCandidateIds?.length) {
          builder.whereIn("external_candidate_id", externalCandidateIds);
        }
      });
    const proposedIds = proposedCandidates.map(
      (candidate: any) => candidate.id,
    );
    let job = await this.database("generation_jobs")
      .where({
        assessment_run_id: row.assessment_run_id,
        owner_user_id: userId,
      })
      .first();

    if (!job) {
      if (!proposedCandidates.length) {
        throw statusError(
          "Automatic import found no recoverable proposed candidates.",
        );
      }
      const selectedExternalIds = new Set(externalCandidateIds || []);
      if (
        externalCandidateIds?.length &&
        (selectedExternalIds.size !== externalCandidateIds.length ||
          selectedExternalIds.size !== proposedCandidates.length)
      ) {
        throw statusError(
          "One or more selected candidate IDs are unknown, duplicated or no longer proposed.",
        );
      }
      job = await new AssessmentControlService(this.database).approveAssessment(
        userId,
        row.assessment_run_id,
        proposedIds,
      );
    }

    let jobItems = await this.database("generation_job_items")
      .where({ generation_job_id: job.id })
      .select("assessment_candidate_id");
    if (!jobItems.length) {
      // A retired or interrupted approval may have committed the job row before
      // its item ledger was available. Rebuild it from durable candidate state.
      const recoverableCandidates = await this.database("assessment_candidates")
        .where({ assessment_run_id: row.assessment_run_id })
        .whereIn("status", ["approved", "proposed"])
        .whereIn("action", ["new", "update"])
        .select("id");
      if (!recoverableCandidates.length) {
        throw statusError(
          "The existing automatic import job has no recoverable candidate ledger.",
          409,
        );
      }
      await this.database("generation_job_items")
        .insert(
          recoverableCandidates.map((candidate: any) => ({
            generation_job_id: job.id,
            assessment_candidate_id: candidate.id,
            status: "pending",
          })),
        )
        .onConflict(["generation_job_id", "assessment_candidate_id"])
        .ignore();
      await this.database("generation_jobs").where({ id: job.id }).update({
        total_items: recoverableCandidates.length,
        updated_at: new Date(),
      });
      jobItems = await this.database("generation_job_items")
        .where({ generation_job_id: job.id })
        .select("assessment_candidate_id");
    }

    const selectedIds = recoverAutomaticApprovalCandidateIds(
      proposedIds,
      jobItems.map((item: any) => item.assessment_candidate_id),
    );
    if (!selectedIds.length) {
      throw statusError(
        "The automatic import job contains no candidates to resume.",
        409,
      );
    }

    // Heal the first half of an interrupted approval. approveAssessment is
    // atomic, but metadata recording and manifest promotion historically ran
    // afterward; a failure there left a durable job behind an approval gate.
    await this.database.transaction(async (trx: any) => {
      await trx("assessment_candidates")
        .where({ assessment_run_id: row.assessment_run_id, status: "proposed" })
        .whereIn("id", selectedIds)
        .update({ status: "approved", updated_at: new Date() });
      await trx("assessment_runs")
        .where({ id: row.assessment_run_id, owner_user_id: userId })
        .update({
          status: "approved",
          approved_at: row.approved_at || new Date(),
          updated_at: new Date(),
        });
      await trx("generation_jobs").where({ id: job.id }).update({
        manifest_id: manifestId,
        total_items: selectedIds.length,
        updated_at: new Date(),
      });
    });

    try {
      await new ProviderNeutralJobRepository(this.database).recordManifest(
        job.id,
        readJson(row.payload, {}),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw statusError(
        `Durable import-plan reconciliation failed: ${message}`,
        500,
      );
    }

    await this.database.transaction(async (trx: any) => {
      await trx("assessment_candidates")
        .where({ assessment_run_id: row.assessment_run_id, status: "proposed" })
        .whereNotIn("id", selectedIds)
        .update({
          status: "rejected",
          decision_reason: "Excluded by the stored automatic import policy",
          updated_at: new Date(),
        });
      await trx("content_pack_manifests")
        .where({ id: manifestId })
        .update({
          status: "processing",
          approved_at: row.approved_at || new Date(),
          sync_status: "synchronized",
          sync_error: null,
          updated_at: new Date(),
        });
      await trx("control_audit_events").insert({
        owner_user_id: userId,
        operation_id: `content-pack:${manifestId}:automatic-resume`,
        event_type: "content_pack.automatically_resumed",
        entity_type: "generation_job",
        entity_id: job.id,
        details: JSON.stringify({
          selectedCount: selectedIds.length,
          recoveredExistingJob: Boolean(
            jobItems.length && proposedCandidates.length === 0,
          ),
        }),
      });
    });
    await this.commitAvailableBatches(userId, manifestId);
    return this.getManifest(userId, manifestId);
  }

  async commitAvailableBatches(userId: string, manifestId: string) {
    const manifestRow = await this.database("content_pack_manifests")
      .where({ id: manifestId, owner_user_id: userId })
      .first();
    if (!manifestRow?.assessment_run_id || !manifestRow.approved_at) return 0;
    const batches = await this.database("content_pack_batches")
      .where({ manifest_id: manifestId, status: "staged" })
      .orderBy("batch_number");
    let committedTotal = 0;
    for (const batchRow of batches) {
      const batch = readJson<ContentBatch>(batchRow.payload, null as any);
      const manifest = readJson<ContentManifest>(
        manifestRow.payload,
        null as any,
      );
      const validation = validateContentBatch(batch, manifest);
      if (!validation.valid) {
        await this.database("content_pack_batches")
          .where({ id: batchRow.id })
          .update({
            status: "invalid",
            validation_report: JSON.stringify({ issues: validation.issues }),
            updated_at: new Date(),
          });
        continue;
      }
      const committed = await this.commitBatch(
        userId,
        manifestRow,
        batchRow,
        batch,
      );
      committedTotal += committed;
    }
    if (committedTotal > 0) {
      await cacheInvalidate(`taxonomy:${userId}`);
    }
    await this.reconcileManifest(userId, manifestId);
    return committedTotal;
  }

  private async commitBatch(
    userId: string,
    manifestRow: any,
    batchRow: any,
    batch: ContentBatch,
  ) {
    const committed = await this.database.transaction(async (trx: any) => {
      const lockedBatch = await trx("content_pack_batches")
        .where({ id: batchRow.id })
        .forUpdate()
        .first();
      if (lockedBatch.status === "committed") {
        return {
          count: 0,
          wordIds: readJson<string[]>(lockedBatch.committed_word_ids, []),
        };
      }
      if (lockedBatch.status !== "staged") return { count: 0, wordIds: [] };
      const candidates = await trx("assessment_candidates")
        .where({ assessment_run_id: manifestRow.assessment_run_id })
        .whereIn(
          "external_candidate_id",
          batch.entries.map((entry) => entry.candidateId),
        );
      const candidateByExternalId = new Map(
        candidates.map((candidate: any) => [
          candidate.external_candidate_id,
          candidate,
        ]),
      );
      const job = await trx("generation_jobs")
        .where({
          assessment_run_id: manifestRow.assessment_run_id,
          owner_user_id: userId,
        })
        .first();
      if (!job) return { count: 0, wordIds: [] };
      const committedWordIds: string[] = [];
      for (const entry of batch.entries) {
        const candidate: any = candidateByExternalId.get(entry.candidateId);
        if (!candidate || candidate.status !== "approved") continue;
        const entryHash = createHash("sha256")
          .update(JSON.stringify(entry))
          .digest("hex");
        const receipt = await trx("content_pack_entry_receipts")
          .where({
            manifest_id: manifestRow.id,
            candidate_id: entry.candidateId,
          })
          .forUpdate()
          .first();
        if (receipt) {
          if (receipt.content_hash !== entryHash) {
            throw statusError(
              `Candidate ${entry.candidateId} was reused with different content.`,
              409,
            );
          }
          committedWordIds.push(receipt.word_id);
          continue;
        }
        const categories = readJson<any[]>(candidate.proposed_categories, []);
        const primary = categories.find(
          (category) => category.relationship === "primary",
        );
        const imported = await new VocabularyImportService(trx).importSingle(
          {
            category: primary?.name,
            word: entry.word,
            pronunciation: entry.pronunciation,
            word_type: entry.wordType,
            item_type: candidate.item_type,
            cefr_level: candidate.cefr_level,
            frequency:
              candidate.usage_frequency === "heavy" ? "High" : "Medium",
            english_meaning: entry.englishMeaning,
            tamil_meaning: entry.tamilMeaning,
            core_idea: entry.coreIdea,
            lesson_data: entry.lesson,
            ...(candidate.sense_decision && candidate.sense_key
              ? {
                  contextual_meaning: candidate.contextual_meaning,
                  sense_decision: candidate.sense_decision,
                  sense_key: candidate.sense_key,
                  matched_word_id: candidate.matched_word_id || undefined,
                  assigned_sense_rank:
                    candidate.allocated_sense_rank || undefined,
                  sense_evidence: readJson(candidate.sense_evidence, undefined),
                }
              : {}),
            taxonomy: {
              taxonomyVersion: candidate.taxonomy_version,
              domainKey: candidate.taxonomy_domain_key,
              usageGroupKey: candidate.taxonomy_usage_group_key,
              categoryKey: candidate.taxonomy_category_key,
              confidence: candidate.taxonomy_confidence,
              reason: candidate.taxonomy_reason || undefined,
            },
          },
          userId,
        );
        if (imported.imported !== 1) {
          const importError =
            imported.errors[0]?.message || `Could not save ${entry.word}`;
          if (isSkippableCandidateAttention(importError)) {
            await trx("generation_job_items")
              .where({
                generation_job_id: job.id,
                assessment_candidate_id: candidate.id,
              })
              .update({
                status: "skipped",
                last_error: importError,
                completed_at: new Date(),
                updated_at: new Date(),
              });
            await trx("assessment_candidates")
              .where({ id: candidate.id })
              .update({
                action: "filtered",
                status: "skipped",
                filter_reason: importError,
                decision_reason: importError,
                updated_at: new Date(),
              });
            await trx("control_audit_events").insert({
              owner_user_id: userId,
              operation_id: `content-pack:${batch.batchId}:${entry.candidateId}:skipped`,
              event_type: "content_pack.entry_skipped",
              entity_type: "assessment_candidate",
              entity_id: candidate.id,
              details: JSON.stringify({
                manifestId: manifestRow.id,
                batchId: batch.batchId,
                candidateId: entry.candidateId,
                term: entry.word,
                reason: importError,
              }),
            });
            continue;
          }
          throw statusError(importError);
        }
        const wordId = imported.items[0].word.id;
        committedWordIds.push(wordId);
        await trx("content_pack_entry_receipts").insert({
          manifest_id: manifestRow.id,
          batch_id: batch.batchId,
          candidate_id: entry.candidateId,
          content_hash: entryHash,
          word_id: wordId,
          verification_report: JSON.stringify({}),
          created_at: new Date(),
          updated_at: new Date(),
        });
        await trx("generation_job_items")
          .where({
            generation_job_id: job.id,
            assessment_candidate_id: candidate.id,
          })
          .update({
            status: "completed",
            committed_word_id: wordId,
            source_batch_id: batch.batchId,
            last_error: null,
            completed_at: new Date(),
            updated_at: new Date(),
          });
        await trx("assessment_candidates").where({ id: candidate.id }).update({
          status: "completed",
          matched_word_id: wordId,
          updated_at: new Date(),
        });
        await trx("control_audit_events").insert({
          owner_user_id: userId,
          operation_id: `content-pack:${batch.batchId}:${entry.candidateId}`,
          event_type: "content_pack.entry_committed",
          entity_type: "vocabulary_word",
          entity_id: wordId,
          details: JSON.stringify({
            manifestId: manifestRow.id,
            batchId: batch.batchId,
            candidateId: entry.candidateId,
          }),
        });
      }
      await trx("content_pack_batches")
        .where({ id: batchRow.id })
        .update({
          status: "committed",
          committed_count: committedWordIds.length,
          committed_word_ids: JSON.stringify(committedWordIds),
          committed_at: new Date(),
          updated_at: new Date(),
        });
      return { count: committedWordIds.length, wordIds: committedWordIds };
    });
    // A batch whose every candidate was safely quarantined still needs a
    // durable zero-entry read-back receipt so it cannot block completion.
    await this.verifyCommittedBatch(userId, batch.batchId, committed.wordIds);
    return committed.count;
  }

  private async verifyCommittedBatch(
    userId: string,
    batchId: string,
    wordIds: string[],
  ) {
    const rows = await this.database("vocabulary_words as words")
      .join("vocabulary_lessons as lessons", "lessons.word_id", "words.id")
      .join("vocabulary_entry_versions as versions", function (this: any) {
        this.on("versions.word_id", "=", "words.id").andOn(
          "versions.version_number",
          "=",
          "words.entry_version",
        );
      })
      .join("user_progress as progress", function (this: any) {
        this.on("progress.word_id", "=", "words.id").andOnVal(
          "progress.user_id",
          "=",
          userId,
        );
      })
      .join("flashcard_queue as queue", function (this: any) {
        this.on("queue.word_id", "=", "words.id").andOnVal(
          "queue.user_id",
          "=",
          userId,
        );
      })
      .join(
        "vocabulary_taxonomy_categories as taxonomy",
        "taxonomy.category_key",
        "words.taxonomy_category_key",
      )
      .whereIn("words.id", [...new Set(wordIds)])
      .where("words.owner_user_id", userId)
      .select("words.id");
    const verifiedIds = new Set(rows.map((row: any) => row.id));
    const missing = [...new Set(wordIds)].filter((id) => !verifiedIds.has(id));
    if (missing.length) {
      throw statusError(
        `Post-commit read-back failed for ${missing.length} entr${missing.length === 1 ? "y" : "ies"}.`,
        500,
      );
    }
    const now = new Date();
    await this.database.transaction(async (trx: any) => {
      await trx("content_pack_entry_receipts")
        .where({ batch_id: batchId })
        .whereIn("word_id", wordIds)
        .update({
          verified_at: now,
          verification_report: JSON.stringify({ verified: true }),
          updated_at: now,
        });
      await trx("content_pack_batches")
        .where({ id: batchId })
        .update({
          readback_verified_at: now,
          readback_report: JSON.stringify({
            verified: true,
            entryCount: new Set(wordIds).size,
          }),
          updated_at: now,
        });
    });
  }

  private async reconcileManifest(userId: string, manifestId: string) {
    const manifestRow = await this.database("content_pack_manifests")
      .where({ id: manifestId, owner_user_id: userId })
      .first();
    if (!manifestRow?.assessment_run_id) return;
    const job = await this.database("generation_jobs")
      .where({
        assessment_run_id: manifestRow.assessment_run_id,
        owner_user_id: userId,
      })
      .first();
    if (!job) return;
    const items = await this.database("generation_job_items")
      .where({ generation_job_id: job.id })
      .select("status");
    const completed = items.filter(
      (item: any) => item.status === "completed",
    ).length;
    const skipped = items.filter(
      (item: any) => item.status === "skipped",
    ).length;
    const manual = items.filter(
      (item: any) => item.status === "manual_review",
    ).length;
    const failed = items.filter((item: any) => item.status === "failed").length;
    const invalidBatches = await this.database("content_pack_batches")
      .where({ manifest_id: manifestId })
      .whereIn("status", ["invalid", "conflict"])
      .count({ count: "id" })
      .first();
    const unresolvedSenses = await this.database("assessment_candidates")
      .where({
        assessment_run_id: manifestRow.assessment_run_id,
        status: "manual_review",
      })
      .count({ count: "id" })
      .first();
    const unresolvedSenseCount = Number(unresolvedSenses?.count || 0);
    const unverifiedBatches = await this.database("content_pack_batches")
      .where({ manifest_id: manifestId, status: "committed" })
      .whereNull("readback_verified_at")
      .count({ count: "id" })
      .first();
    const complete =
      completed + skipped === Number(job.total_items) &&
      unresolvedSenseCount === 0 &&
      Number(unverifiedBatches?.count || 0) === 0;
    const attention =
      manual > 0 ||
      failed > 0 ||
      unresolvedSenseCount > 0 ||
      Number(invalidBatches?.count) > 0;
    const status = complete
      ? "completed"
      : attention
        ? "attention_required"
        : "processing";
    await this.database.transaction(async (trx: any) => {
      await trx("generation_jobs")
        .where({ id: job.id })
        .update({
          status: complete
            ? "completed"
            : attention
              ? "manual_review"
              : "processing",
          completed_items: completed,
          failed_items: failed,
          manual_review_items: manual + unresolvedSenseCount,
          updated_at: new Date(),
        });
      await trx("assessment_runs")
        .where({ id: manifestRow.assessment_run_id })
        .update({
          status,
          completed_at: complete ? new Date() : null,
          updated_at: new Date(),
        });
      await trx("content_pack_manifests")
        .where({ id: manifestId })
        .update({
          status,
          completed_at: complete ? new Date() : null,
          updated_at: new Date(),
        });
    });
  }

  async verifyManifest(userId: string, manifestId: string) {
    const manifest = await this.getManifest(userId, manifestId);
    const manifestRow = await this.database("content_pack_manifests")
      .where({ id: manifestId, owner_user_id: userId })
      .first();
    const job = manifestRow?.assessment_run_id
      ? await this.database("generation_jobs")
          .where({
            assessment_run_id: manifestRow.assessment_run_id,
            owner_user_id: userId,
          })
          .first()
      : null;
    const issues: string[] = [];
    if (manifest.status !== "completed") {
      issues.push(`Import status is ${manifest.status}, not completed.`);
    }
    if (manifest.generation.missingBatches !== 0) {
      issues.push(
        `${manifest.generation.missingBatches} planned batch(es) are missing.`,
      );
    }
    if (manifest.generation.invalidBatches !== 0) {
      issues.push(
        `${manifest.generation.invalidBatches} batch(es) are invalid or conflicting.`,
      );
    }
    if (
      manifest.generation.receivedBatches !== manifest.generation.plannedBatches
    ) {
      issues.push("Received batch count does not match the generation plan.");
    }
    const wordIds = manifest.batches.flatMap((batch: any) =>
      readJson<string[]>(batch.committed_word_ids, []),
    );
    const uniqueWordIds = [...new Set(wordIds)];
    if (uniqueWordIds.length !== wordIds.length) {
      issues.push("Committed word IDs contain duplicates.");
    }
    if (wordIds.length !== manifest.generation.committedEntries) {
      issues.push("Committed entry count does not match the batch ledger.");
    }
    const jobItems = job
      ? await this.database("generation_job_items")
          .where({ generation_job_id: job.id })
          .select(
            "status",
            "committed_word_id",
            "source_batch_id",
            "last_error",
          )
      : [];
    const completedJobItems = jobItems.filter(
      (item: any) => item.status === "completed",
    );
    const skippedJobItems = jobItems.filter(
      (item: any) => item.status === "skipped",
    );
    if (!job || wordIds.length !== completedJobItems.length) {
      issues.push(
        "Committed entry count does not match the approved import count.",
      );
    }
    if (
      job &&
      completedJobItems.some(
        (item: any) => !item.committed_word_id || !item.source_batch_id,
      )
    ) {
      issues.push("One or more approved entries are not fully committed.");
    }
    if (
      job &&
      (completedJobItems.length + skippedJobItems.length !== jobItems.length ||
        skippedJobItems.some(
          (item: any) =>
            item.committed_word_id || item.source_batch_id || !item.last_error,
        ))
    ) {
      issues.push(
        "One or more import items are not in a valid terminal state.",
      );
    }
    if (!wordIds.length) {
      const emptyImportVerified =
        manifest.status === "completed" &&
        completedJobItems.length === 0 &&
        skippedJobItems.length === jobItems.length &&
        issues.length === 0;
      const report = {
        verified: emptyImportVerified,
        entries: 0,
        issues: emptyImportVerified
          ? []
          : [...issues, "No entries are committed yet."],
      };
      await this.storeVerification(manifestId, report);
      return report;
    }
    const rows = await this.database("vocabulary_words as words")
      .leftJoin("vocabulary_lessons as lessons", "lessons.word_id", "words.id")
      .leftJoin("user_progress as progress", function (this: any) {
        this.on("progress.word_id", "=", "words.id").andOnVal(
          "progress.user_id",
          "=",
          userId,
        );
      })
      .leftJoin("flashcard_queue as queue", function (this: any) {
        this.on("queue.word_id", "=", "words.id").andOnVal(
          "queue.user_id",
          "=",
          userId,
        );
      })
      .leftJoin(
        "vocabulary_taxonomy_categories as taxonomy_category",
        "taxonomy_category.category_key",
        "words.taxonomy_category_key",
      )
      .leftJoin(
        "vocabulary_taxonomy_usage_groups as taxonomy_group",
        "taxonomy_group.usage_group_key",
        "taxonomy_category.usage_group_key",
      )
      .leftJoin(
        "vocabulary_taxonomy_domains as taxonomy_domain",
        "taxonomy_domain.domain_key",
        "taxonomy_category.domain_key",
      )
      .whereIn("words.id", uniqueWordIds)
      .where("words.owner_user_id", userId)
      .select(
        "words.id",
        "words.word",
        "lessons.id as lesson_id",
        "progress.id as progress_id",
        "queue.id as queue_id",
        "words.taxonomy_category_key",
        "taxonomy_category.name as taxonomy_category_name",
        "taxonomy_group.usage_group_key as taxonomy_usage_group_key",
        "taxonomy_domain.domain_key as taxonomy_domain_key",
      );
    for (const row of rows) {
      if (!row.lesson_id) issues.push(`${row.word}: lesson row is missing`);
      if (!row.progress_id) issues.push(`${row.word}: progress row is missing`);
      if (!row.queue_id) issues.push(`${row.word}: review card is missing`);
      if (
        !row.taxonomy_category_key ||
        !row.taxonomy_category_name ||
        !row.taxonomy_usage_group_key ||
        !row.taxonomy_domain_key
      ) {
        issues.push(
          `${row.word}: complete domain, usage group and specific category are required`,
        );
      }
    }
    if (rows.length !== uniqueWordIds.length) {
      issues.push("One or more committed word rows could not be read back.");
    }
    const report = {
      verified: issues.length === 0,
      // Report logical imported entries. Database word rows are unique and can
      // be fewer only when an existing sense was updated.
      entries: wordIds.length,
      issues,
    };
    await this.storeVerification(manifestId, report);
    return report;
  }

  private async storeVerification(
    manifestId: string,
    report: { verified: boolean; entries: number; issues: string[] },
  ) {
    await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .update({
        last_verified_at: new Date(),
        verification_report: JSON.stringify(report),
        updated_at: new Date(),
      });
  }

  async markInboxCleaned(manifestId: string, commitSha: string) {
    const row = await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .first();
    if (!row) throw statusError("ChatGPT content manifest not found", 404);
    if (row.status !== "completed") {
      throw statusError("Only a completed manifest can be marked as cleaned.");
    }
    const verification = readJson<{
      verified?: boolean;
      issues?: string[];
    }>(row.verification_report, {});
    if (!verification.verified) {
      throw statusError(
        "Inbox cleanup requires a successful database read-back verification.",
      );
    }
    await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .update({
        inbox_cleaned_at: new Date(),
        inbox_cleanup_commit: commitSha,
        cleanup_attempts: Number(row.cleanup_attempts || 0) + 1,
        cleanup_error: null,
        updated_at: new Date(),
      });
  }

  async markInboxCleanupFailed(manifestId: string, message: string) {
    const row = await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .first();
    if (!row) throw statusError("ChatGPT content manifest not found", 404);
    await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .update({
        cleanup_attempts: Number(row.cleanup_attempts || 0) + 1,
        cleanup_error: message.slice(0, 10_000),
        updated_at: new Date(),
      });
  }

  private async manifestSummary(row: any) {
    const manifest = readJson<ContentManifest>(row.payload, null as any);
    const batches = await this.database("content_pack_batches")
      .where({ manifest_id: row.id })
      .select("status", "entry_count", "committed_count", "batch_number");
    const received = batches.filter(
      (batch: any) => batch.status !== "invalid",
    ).length;
    const committed = batches.reduce(
      (total: number, batch: any) => total + Number(batch.committed_count || 0),
      0,
    );
    const invalid = batches.filter((batch: any) =>
      ["invalid", "conflict"].includes(batch.status),
    ).length;
    const planned = manifest.generationPlan.batches.length;
    const checkpoint = buildBatchCheckpoint(
      row.id,
      manifest.generationPlan.batches.map((batch) => batch.batchNumber),
      batches
        .filter((batch: any) => batch.status !== "invalid")
        .map((batch: any) => Number(batch.batch_number)),
      manifest.generationPlan.batches,
    );
    return {
      id: row.id,
      sourceName: row.source_name,
      sourceType: row.source_type,
      status: row.status,
      ownerUserId: row.owner_user_id,
      claimed: Boolean(row.owner_user_id),
      counts: readJson(row.counts, {}),
      coverage: manifest.coverage,
      generation: {
        plannedBatches: planned,
        receivedBatches: received,
        missingBatches: Math.max(0, planned - received),
        invalidBatches: invalid,
        committedEntries: committed,
        ...checkpoint,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      inboxCleanedAt: row.inbox_cleaned_at,
      inboxCleanupCommit: row.inbox_cleanup_commit,
      inboxBranch: row.inbox_branch,
      fetchedCommit: row.fetched_commit,
      lastSyncedAt: row.last_synced_at,
      syncStatus: row.sync_status,
      syncError: row.sync_error,
      lastVerifiedAt: row.last_verified_at,
      verification: readJson(row.verification_report, {}),
      cleanupAttempts: Number(row.cleanup_attempts || 0),
      cleanupError: row.cleanup_error,
      nextAction: this.nextAction(row, planned, received, invalid),
    };
  }

  private nextAction(
    row: any,
    planned: number,
    received: number,
    invalid: number,
  ) {
    if (!row.owner_user_id)
      return "Waiting for automatic account ownership assignment.";
    if (invalid > 0)
      return "Automatic import paused because one or more batch files are invalid.";
    if (received < planned)
      return `Waiting for ${planned - received} missing planned batch(es).`;
    if (row.sync_status === "retry_pending")
      return "Automatic recovery is pending and retries every five minutes.";
    if (row.status === "awaiting_approval")
      return "Automatic recovery will promote this legacy import and commit its validated batches.";
    if (row.status !== "completed")
      return "Automatic import is processing; no learner action is required.";
    const verification = readJson<{ verified?: boolean }>(
      row.verification_report,
      {},
    );
    if (!verification.verified) return "Run PostgreSQL read-back verification.";
    if (!row.inbox_cleaned_at)
      return "Synchronize again to retry verified inbox cleanup.";
    return "Completed, verified and removed from the active inbox.";
  }

  private async recordIngestErrors(
    errors: Array<{ path: string; message: string }>,
    documents: ContentPackDocument[],
    parsed: Array<(ContentPackDocument & { value: any }) | null>,
    context: ContentPackIngestContext,
  ) {
    const documentByPath = new Map(
      documents.map((document) => [document.path, document]),
    );
    const parsedByPath = new Map(
      parsed
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => [item.path, item.value]),
    );
    const errorsByPath = new Map<string, string[]>();
    for (const error of errors) {
      const issues = errorsByPath.get(error.path) || [];
      issues.push(error.message);
      errorsByPath.set(error.path, issues);
    }
    for (const [documentPath, issues] of errorsByPath) {
      const document = documentByPath.get(documentPath);
      if (!document) continue;
      const contentHash = createHash("sha256")
        .update(document.content)
        .digest("hex");
      const value = parsedByPath.get(documentPath);
      const packId = value?.manifestId || value?.batchId || null;
      const existing = await this.database("content_pack_ingest_errors")
        .where({ document_path: documentPath, content_hash: contentHash })
        .first();
      const payload = {
        pack_id: packId,
        status: "active",
        issues: JSON.stringify(issues),
        updated_at: new Date(),
      };
      if (existing) {
        await this.database("content_pack_ingest_errors")
          .where({ id: existing.id })
          .update(payload);
      } else {
        await this.database("content_pack_ingest_errors").insert({
          document_path: documentPath,
          content_hash: contentHash,
          ...payload,
          created_at: new Date(),
        });
      }
    }
    const validPaths = documents
      .map((document) => document.path)
      .filter((documentPath) => !errorsByPath.has(documentPath));
    for (const documentPath of validPaths) {
      await this.database("content_pack_ingest_errors")
        .where({ document_path: documentPath, status: "active" })
        .update({ status: "resolved", updated_at: new Date() });
    }

    // A GitHub inbox synchronization is a complete snapshot. Resolve active
    // errors for ChatGPT documents that are no longer present, while keeping
    // internal in-app diagnostics isolated from this reconciliation.
    if (
      (context.inboxBranch || "chatgpt-content-inbox") ===
      "chatgpt-content-inbox"
    ) {
      const currentPaths = documents.map((document) => document.path);
      const staleErrors = this.database("content_pack_ingest_errors")
        .where({ status: "active" })
        .whereNot("document_path", "like", "inapp/%");
      if (currentPaths.length) {
        staleErrors.whereNotIn("document_path", currentPaths);
      }
      await staleErrors.update({ status: "resolved", updated_at: new Date() });
    }
  }
}

export function loadContentPacksFromGit(
  ref: string,
  repoRoot = path.resolve(__dirname, "../../../.."),
): ContentPackDocument[] {
  if (!/^[0-9a-f]{40}$/i.test(ref)) {
    throw statusError("A valid fetched inbox commit is required.");
  }
  const output = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", ref, "content-packs/inbox"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.endsWith(".json"))
    .map((file) => ({
      path: file,
      content: execFileSync("git", ["show", `${ref}:${file}`], {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 25 * 1024 * 1024,
      }),
    }));
}

export function loadContentPackDocuments(
  directory: string,
): ContentPackDocument[] {
  if (!fs.existsSync(directory)) return [];
  const documents: ContentPackDocument[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      if (entry.isFile() && entry.name.endsWith(".json")) {
        documents.push({
          path: path.relative(directory, absolute),
          content: fs.readFileSync(absolute, "utf8"),
        });
      }
    }
  };
  visit(directory);
  return documents.sort((left, right) => left.path.localeCompare(right.path));
}

export async function synchronizeContentPacks(
  database: Knex | any,
  directory = path.resolve(process.cwd(), "content-packs", "inbox"),
) {
  const documents = loadContentPackDocuments(directory);
  return new ContentPackService(database).ingestDocuments(documents);
}
