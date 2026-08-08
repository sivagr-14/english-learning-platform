import fs from "fs";
import path from "path";
import { createHash } from "crypto";
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
  ): Promise<ContentPackSyncResult> {
    const result: ContentPackSyncResult = {
      manifestsAdded: 0,
      batchesAdded: 0,
      unchanged: 0,
      committedEntries: 0,
      errors: [],
      cleanupEligible: [],
    };
    const parsed = documents.map((document) => {
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
          await this.database("content_pack_manifests")
            .where({ id: validation.value.manifestId })
            .update({
              status: "conflict",
              validation_report: JSON.stringify({
                issues: [
                  "The same manifestId was reused with different content.",
                ],
              }),
              updated_at: new Date(),
            });
          result.errors.push({
            path: document.path,
            message: "The manifest ID already exists with different content.",
          });
        } else {
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
          await this.database("content_pack_batches")
            .where({ id: existing.id })
            .update({
              status: "conflict",
              validation_report: JSON.stringify({
                issues: ["The same batchId was reused with different content."],
              }),
              updated_at: new Date(),
            });
          result.errors.push({
            path: document.path,
            message: "The batch ID already exists with different content.",
          });
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
        await this.database("content_pack_batches")
          .where({ id: occupiedPlanSlot.id })
          .update({
            status: "conflict",
            validation_report: JSON.stringify({
              issues: [
                "A different batchId already occupies this planned batch number.",
              ],
            }),
            updated_at: new Date(),
          });
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

    await this.recordIngestErrors(result.errors, documents, parsed);

    const claimed = await this.database("content_pack_manifests")
      .whereNotNull("owner_user_id")
      .whereNull("inbox_cleaned_at")
      .select("id", "owner_user_id");
    for (const manifest of claimed) {
      const committed = await this.commitAvailableBatches(
        manifest.owner_user_id,
        manifest.id,
      );
      result.committedEntries += committed;
      const verification = await this.verifyManifest(
        manifest.owner_user_id,
        manifest.id,
      );
      if (verification.verified) result.cleanupEligible.push(manifest.id);
    }
    return result;
  }

  async listManifests(userId: string) {
    const rows = await this.database("content_pack_manifests")
      .where((builder: any) =>
        builder.whereNull("owner_user_id").orWhere("owner_user_id", userId),
      )
      .orderBy("created_at", "desc");
    return Promise.all(rows.map((row: any) => this.manifestSummary(row)));
  }

  async listIngestErrors() {
    return this.database("content_pack_ingest_errors")
      .where({ status: "active" })
      .orderBy("updated_at", "desc")
      .select("document_path", "pack_id", "issues", "created_at", "updated_at");
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
              transport: "chatgpt-content-inbox",
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

  async approveManifest(
    userId: string,
    manifestId: string,
    externalCandidateIds?: string[],
  ) {
    const row = await this.database("content_pack_manifests")
      .where({ id: manifestId, owner_user_id: userId })
      .first();
    if (!row) throw statusError("Claim this manifest before approval", 404);
    if (row.status === "attention_required") {
      throw statusError(
        "Unreadable pages or chunks must be resolved before approval.",
      );
    }
    const candidates = await this.database("assessment_candidates")
      .where({ assessment_run_id: row.assessment_run_id, status: "proposed" })
      .modify((builder: any) => {
        if (externalCandidateIds?.length) {
          builder.whereIn("external_candidate_id", externalCandidateIds);
        }
      });
    if (!candidates.length) {
      const existingJob = await this.database("generation_jobs")
        .where({
          assessment_run_id: row.assessment_run_id,
          owner_user_id: userId,
        })
        .first();
      if (existingJob) return this.getManifest(userId, manifestId);
      throw statusError("No new or updated candidates were selected");
    }
    const selectedIds = candidates.map((candidate: any) => candidate.id);
    const selectedExternalIds = new Set(externalCandidateIds || []);
    if (
      externalCandidateIds?.length &&
      (selectedExternalIds.size !== externalCandidateIds.length ||
        selectedExternalIds.size !== candidates.length)
    ) {
      throw statusError(
        "One or more selected candidate IDs are unknown, duplicated or no longer proposed.",
      );
    }
    const job = await new AssessmentControlService(
      this.database,
    ).approveAssessment(userId, row.assessment_run_id, selectedIds);
    await this.database("generation_jobs").where({ id: job.id }).update({
      manifest_id: manifestId,
      updated_at: new Date(),
    });
    await new ProviderNeutralJobRepository(this.database).recordManifest(
      job.id,
      readJson(row.payload, {}),
    );
    await this.database.transaction(async (trx: any) => {
      await trx("assessment_candidates")
        .where({ assessment_run_id: row.assessment_run_id, status: "proposed" })
        .whereNotIn("id", selectedIds)
        .update({
          status: "rejected",
          decision_reason: "Not selected during local approval",
          updated_at: new Date(),
        });
      await trx("content_pack_manifests").where({ id: manifestId }).update({
        status: "processing",
        approved_at: new Date(),
        updated_at: new Date(),
      });
      await trx("control_audit_events").insert({
        owner_user_id: userId,
        operation_id: `content-pack:${manifestId}:approve`,
        event_type: "content_pack.approved",
        entity_type: "generation_job",
        entity_id: job.id,
        details: JSON.stringify({ selectedCount: selectedIds.length }),
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
    return this.database.transaction(async (trx: any) => {
      const lockedBatch = await trx("content_pack_batches")
        .where({ id: batchRow.id })
        .forUpdate()
        .first();
      if (lockedBatch.status === "committed") return 0;
      if (lockedBatch.status !== "staged") return 0;
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
      if (!job) return 0;
      const committedWordIds: string[] = [];
      for (const entry of batch.entries) {
        const candidate: any = candidateByExternalId.get(entry.candidateId);
        if (!candidate || candidate.status !== "approved") continue;
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
          throw statusError(
            imported.errors[0]?.message || `Could not save ${entry.word}`,
          );
        }
        const wordId = imported.items[0].word.id;
        committedWordIds.push(wordId);
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
      return committedWordIds.length;
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
    const complete =
      completed === Number(job.total_items) && unresolvedSenseCount === 0;
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
    const wordIds = [
      ...new Set(
        manifest.batches.flatMap((batch: any) =>
          readJson<string[]>(batch.committed_word_ids, []),
        ),
      ),
    ];
    const uniqueWordIds = [...new Set(wordIds)];
    if (uniqueWordIds.length !== wordIds.length) {
      issues.push("Committed word IDs contain duplicates.");
    }
    if (wordIds.length !== manifest.generation.committedEntries) {
      issues.push("Committed entry count does not match the batch ledger.");
    }
    if (!job || wordIds.length !== Number(job.total_items)) {
      issues.push(
        "Committed entry count does not match the approved import count.",
      );
    }
    if (!wordIds.length) {
      return {
        verified: false,
        entries: 0,
        issues: [...issues, "No entries are committed yet."],
      };
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
    return { verified: issues.length === 0, entries: rows.length, issues };
  }

  async markInboxCleaned(manifestId: string, commitSha: string) {
    const row = await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .first();
    if (!row) throw statusError("ChatGPT content manifest not found", 404);
    if (row.status !== "completed") {
      throw statusError("Only a completed manifest can be marked as cleaned.");
    }
    await this.database("content_pack_manifests")
      .where({ id: manifestId })
      .update({
        inbox_cleaned_at: new Date(),
        inbox_cleanup_commit: commitSha,
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
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      inboxCleanedAt: row.inbox_cleaned_at,
      inboxCleanupCommit: row.inbox_cleanup_commit,
    };
  }

  private async recordIngestErrors(
    errors: Array<{ path: string; message: string }>,
    documents: ContentPackDocument[],
    parsed: Array<(ContentPackDocument & { value: any }) | null>,
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
  }
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
