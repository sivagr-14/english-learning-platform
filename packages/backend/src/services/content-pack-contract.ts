import { createHash } from "crypto";
import { z } from "zod";
import {
  assertVocabularyLessonCompliant,
  VocabularyLessonSchema,
} from "../data/vocabulary-lesson-template";
import {
  normalizeSenseKey,
  normalizeVocabularyTerm,
} from "./vocabulary-sense.service";
import {
  isValidTaxonomyPath,
  TAXONOMY_VERSION,
  taxonomyPathForCategoryKey,
} from "../data/vocabulary-taxonomy";

export const LEGACY_CONTENT_MANIFEST_VERSION =
  "chatgpt-vocabulary-manifest-v1" as const;
export const LEGACY_CONTENT_BATCH_VERSION =
  "chatgpt-vocabulary-batch-v1" as const;
export const SENSE_AWARE_CONTENT_MANIFEST_VERSION =
  "chatgpt-vocabulary-manifest-v2" as const;
export const SENSE_AWARE_CONTENT_BATCH_VERSION =
  "chatgpt-vocabulary-batch-v2" as const;
export const CONTENT_MANIFEST_VERSION =
  "chatgpt-vocabulary-manifest-v3" as const;
export const CONTENT_BATCH_VERSION = "chatgpt-vocabulary-batch-v3" as const;

const IdentifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(140)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const UsefulTextSchema = z.string().trim().min(8).max(10_000);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const CefrSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);

export const SourceOccurrenceSchema = z
  .object({
    page: z.number().int().positive(),
    chunkId: IdentifierSchema,
    sentence: UsefulTextSchema,
  })
  .strict();

const LegacyManifestCandidateSchema = z
  .object({
    candidateId: IdentifierSchema,
    term: z.string().trim().min(1).max(255),
    baseForm: z.string().trim().min(1).max(255),
    itemType: z.enum([
      "word",
      "phrasal verb",
      "idiom",
      "collocation",
      "fixed phrase",
      "conversational pattern",
    ]),
    decision: z.enum(["generate", "existing", "filtered", "rejected"]),
    operation: z.enum(["new", "update"]).optional(),
    cefrLevel: CefrSchema.optional(),
    usageFrequency: z.enum(["heavy", "medium", "low"]).optional(),
    fluencyValue: z.enum(["essential", "useful", "specialized"]).optional(),
    categoryName: z.string().trim().min(1).max(180).optional(),
    contextualMeaning: UsefulTextSchema.optional(),
    reason: UsefulTextSchema.optional(),
    occurrences: z.array(SourceOccurrenceSchema).min(1).max(500),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (candidate.decision === "generate") {
      for (const field of [
        "operation",
        "cefrLevel",
        "usageFrequency",
        "fluencyValue",
        "categoryName",
        "contextualMeaning",
      ] as const) {
        if (!candidate[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for generated candidates`,
          });
        }
      }
      if (candidate.usageFrequency === "low") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["usageFrequency"],
          message: "low-frequency candidates must be filtered, not generated",
        });
      }
    } else if (!candidate.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "a specific accounting reason is required",
      });
    }
  });

const SenseEvidenceSchema = z
  .object({
    sentence: UsefulTextSchema,
    explanation: UsefulTextSchema,
  })
  .strict();

export const TaxonomyAssignmentSchema = z
  .object({
    taxonomyVersion: z.literal(TAXONOMY_VERSION),
    domainKey: IdentifierSchema,
    usageGroupKey: IdentifierSchema,
    categoryKey: IdentifierSchema,
    confidence: z.enum(["high", "medium", "low"]),
    reason: UsefulTextSchema.optional(),
  })
  .strict()
  .superRefine((taxonomy, context) => {
    if (!isValidTaxonomyPath(taxonomy)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryKey"],
        message:
          "domainKey, usageGroupKey and categoryKey must form one active controlled taxonomy path",
      });
    }
    if (taxonomy.confidence === "low" && !taxonomy.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "low-confidence categorization requires a specific reason",
      });
    }
  });

const SenseAwareManifestCandidateSchema = z
  .object({
    candidateId: IdentifierSchema,
    term: z.string().trim().min(1).max(255),
    baseForm: z.string().trim().min(1).max(255),
    itemType: z.enum([
      "word",
      "phrasal verb",
      "idiom",
      "collocation",
      "fixed phrase",
      "conversational pattern",
    ]),
    decision: z.enum(["generate", "existing", "filtered", "rejected"]),
    senseDecision: z.enum(["same_sense", "new_sense", "ambiguous"]),
    senseKey: z.string().trim().min(3).max(180),
    matchedWordId: z.string().uuid().optional(),
    cefrLevel: CefrSchema.optional(),
    usageFrequency: z.enum(["heavy", "medium", "low"]).optional(),
    fluencyValue: z.enum(["essential", "useful", "specialized"]).optional(),
    categoryName: z.string().trim().min(1).max(180).optional(),
    contextualMeaning: UsefulTextSchema,
    senseEvidence: SenseEvidenceSchema,
    taxonomy: TaxonomyAssignmentSchema.optional(),
    reason: UsefulTextSchema.optional(),
    occurrences: z.array(SourceOccurrenceSchema).min(1).max(500),
  })
  .strict()
  .superRefine((candidate, context) => {
    if (!normalizeSenseKey(candidate.senseKey)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senseKey"],
        message: "senseKey must contain a stable descriptive identity",
      });
    }
    if (candidate.decision === "generate") {
      for (const field of [
        "cefrLevel",
        "usageFrequency",
        "fluencyValue",
        "categoryName",
      ] as const) {
        if (!candidate[field]) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for generated candidates`,
          });
        }
      }
      if (candidate.usageFrequency === "low") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["usageFrequency"],
          message: "low-frequency candidates must be filtered, not generated",
        });
      }
      if (candidate.senseDecision === "ambiguous") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["senseDecision"],
          message: "ambiguous senses must be held, not generated",
        });
      }
    } else if (!candidate.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "a specific accounting reason is required",
      });
    }
    if (
      candidate.decision === "existing" &&
      candidate.senseDecision !== "same_sense"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["senseDecision"],
        message: "existing candidates must identify the same stored sense",
      });
    }
  });

export const ManifestCandidateSchema = z.union([
  LegacyManifestCandidateSchema,
  SenseAwareManifestCandidateSchema,
]);

const PageCoverageSchema = z
  .object({
    page: z.number().int().positive(),
    status: z.enum(["assessed", "unreadable"]),
    chunkIds: z.array(IdentifierSchema),
    error: UsefulTextSchema.optional(),
  })
  .strict();

const ChunkCoverageSchema = z
  .object({
    chunkId: IdentifierSchema,
    pageStart: z.number().int().positive(),
    pageEnd: z.number().int().positive(),
    status: z.enum(["assessed", "unreadable"]),
    candidateIds: z.array(IdentifierSchema),
    error: UsefulTextSchema.optional(),
  })
  .strict();

const ManifestCountsSchema = z
  .object({
    totalCandidates: z.number().int().nonnegative(),
    generate: z.number().int().nonnegative(),
    existing: z.number().int().nonnegative(),
    filtered: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    heavyUse: z.number().int().nonnegative(),
    mediumUse: z.number().int().nonnegative(),
  })
  .strict();

const BatchPlanSchema = z
  .object({
    batchNumber: z.number().int().positive(),
    candidateIds: z.array(IdentifierSchema).min(1).max(10),
  })
  .strict();

const LegacyContentManifestSchema = z
  .object({
    formatVersion: z.literal(LEGACY_CONTENT_MANIFEST_VERSION),
    manifestId: IdentifierSchema,
    createdAt: z.string().datetime(),
    source: z
      .object({
        name: z.string().trim().min(1).max(255),
        type: z.enum(["text", "pdf", "docx", "srt", "vtt", "csv", "other"]),
        contentHash: Sha256Schema,
        totalPages: z.number().int().positive().max(20_000),
        totalChunks: z.number().int().positive().max(50_000),
      })
      .strict(),
    coverage: z
      .object({
        pages: z.array(PageCoverageSchema).min(1).max(20_000),
        chunks: z.array(ChunkCoverageSchema).min(1).max(50_000),
      })
      .strict(),
    candidates: z.array(ManifestCandidateSchema).max(50_000),
    counts: ManifestCountsSchema,
    generationPlan: z
      .object({
        batchSize: z.number().int().min(1).max(10),
        batches: z.array(BatchPlanSchema).max(10_000),
      })
      .strict(),
  })
  .strict();

const SenseAwareContentManifestSchema = LegacyContentManifestSchema.omit({
  formatVersion: true,
  candidates: true,
})
  .extend({
    formatVersion: z.literal(SENSE_AWARE_CONTENT_MANIFEST_VERSION),
    candidates: z.array(SenseAwareManifestCandidateSchema).max(50_000),
  })
  .strict();

const TaxonomyAwareContentManifestSchema = LegacyContentManifestSchema.omit({
  formatVersion: true,
  candidates: true,
})
  .extend({
    formatVersion: z.literal(CONTENT_MANIFEST_VERSION),
    candidates: z.array(SenseAwareManifestCandidateSchema).max(50_000),
  })
  .strict();

export const ContentManifestSchema = z.union([
  LegacyContentManifestSchema,
  SenseAwareContentManifestSchema,
  TaxonomyAwareContentManifestSchema,
]);

export const GeneratedPackEntrySchema = z
  .object({
    candidateId: IdentifierSchema,
    word: z.string().trim().min(1).max(255),
    pronunciation: z.string().trim().min(2).max(255),
    wordType: z.string().trim().min(2).max(80),
    englishMeaning: UsefulTextSchema,
    tamilMeaning: z.string().trim().min(2).max(10_000),
    coreIdea: UsefulTextSchema,
    lesson: VocabularyLessonSchema,
  })
  .strict();

const LegacyContentBatchSchema = z
  .object({
    formatVersion: z.literal(LEGACY_CONTENT_BATCH_VERSION),
    batchId: IdentifierSchema,
    manifestId: IdentifierSchema,
    manifestHash: Sha256Schema,
    batchNumber: z.number().int().positive(),
    createdAt: z.string().datetime(),
    entries: z.array(GeneratedPackEntrySchema).min(1).max(10),
  })
  .strict();

const SenseAwareContentBatchSchema = LegacyContentBatchSchema.omit({
  formatVersion: true,
})
  .extend({ formatVersion: z.literal(SENSE_AWARE_CONTENT_BATCH_VERSION) })
  .strict();

const TaxonomyAwareContentBatchSchema = LegacyContentBatchSchema.omit({
  formatVersion: true,
})
  .extend({ formatVersion: z.literal(CONTENT_BATCH_VERSION) })
  .strict();

export const ContentBatchSchema = z.union([
  LegacyContentBatchSchema,
  SenseAwareContentBatchSchema,
  TaxonomyAwareContentBatchSchema,
]);

export type ContentManifest = z.infer<typeof ContentManifestSchema>;
export type ContentBatch = z.infer<typeof ContentBatchSchema>;

export interface PackValidationResult<T> {
  valid: boolean;
  value?: T;
  issues: string[];
  hash?: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentPackHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function schemaIssues(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) =>
      `${issue.path.length ? issue.path.join(".") : "pack"}: ${issue.message}`,
  );
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

export function isSenseAwareManifest(
  manifest: ContentManifest,
): manifest is
  | z.infer<typeof SenseAwareContentManifestSchema>
  | z.infer<typeof TaxonomyAwareContentManifestSchema> {
  return manifest.formatVersion !== LEGACY_CONTENT_MANIFEST_VERSION;
}

export function isTaxonomyAwareManifest(
  manifest: ContentManifest,
): manifest is z.infer<typeof TaxonomyAwareContentManifestSchema> {
  return manifest.formatVersion === CONTENT_MANIFEST_VERSION;
}

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function validateContentManifest(
  raw: unknown,
): PackValidationResult<ContentManifest> {
  const parsed = ContentManifestSchema.safeParse(raw);
  if (!parsed.success)
    return { valid: false, issues: schemaIssues(parsed.error) };
  const manifest = parsed.data;
  const issues: string[] = [];

  const candidateIds = manifest.candidates.map((item) => item.candidateId);
  const duplicateCandidates = duplicates(candidateIds);
  if (duplicateCandidates.length) {
    issues.push(
      `candidates: duplicate candidate IDs: ${[...new Set(duplicateCandidates)].join(", ")}`,
    );
  }
  if (isSenseAwareManifest(manifest)) {
    const duplicateSenses = duplicates(
      manifest.candidates.map(
        (candidate) =>
          `${normalizeVocabularyTerm(candidate.term)}|${normalizeSenseKey(candidate.senseKey)}`,
      ),
    );
    if (duplicateSenses.length) {
      issues.push(
        "candidates: each normalized term and contextual sense may appear only once; merge same-sense occurrences",
      );
    }
  } else {
    const duplicateTerms = duplicates(
      manifest.candidates.map((candidate) =>
        candidate.term.trim().toLowerCase(),
      ),
    );
    if (duplicateTerms.length) {
      issues.push(
        "candidates: each normalized term may appear only once; merge repeated occurrences",
      );
    }
  }
  if (isTaxonomyAwareManifest(manifest)) {
    for (const candidate of manifest.candidates) {
      if (candidate.decision !== "generate") continue;
      if (!candidate.taxonomy) {
        issues.push(
          `${candidate.candidateId}: generated candidates require domain, usage group and specific category`,
        );
        continue;
      }
      const path = taxonomyPathForCategoryKey(candidate.taxonomy.categoryKey);
      if (!path || !isValidTaxonomyPath(candidate.taxonomy)) {
        issues.push(
          `${candidate.candidateId}: taxonomy keys do not form a valid controlled path`,
        );
      } else if (
        candidate.categoryName &&
        normalizedText(candidate.categoryName) !==
          normalizedText(path.categoryName)
      ) {
        issues.push(
          `${candidate.candidateId}: categoryName must match the selected specific taxonomy category`,
        );
      }
    }
  }

  const pageNumbers = manifest.coverage.pages.map((page) => page.page);
  const expectedPages = Array.from(
    { length: manifest.source.totalPages },
    (_, index) => index + 1,
  );
  if (JSON.stringify(pageNumbers) !== JSON.stringify(expectedPages)) {
    issues.push(
      "coverage.pages: must account for every page exactly once in order",
    );
  }

  const chunkIds = manifest.coverage.chunks.map((chunk) => chunk.chunkId);
  if (chunkIds.length !== manifest.source.totalChunks) {
    issues.push("coverage.chunks: total does not match source.totalChunks");
  }
  const duplicateChunks = duplicates(chunkIds);
  if (duplicateChunks.length) {
    issues.push("coverage.chunks: every chunk ID must be unique");
  }
  const knownChunks = new Set(chunkIds);
  const chunkStatus = new Map(
    manifest.coverage.chunks.map((chunk) => [chunk.chunkId, chunk.status]),
  );
  const knownCandidates = new Set(candidateIds);

  for (const page of manifest.coverage.pages) {
    if (page.status === "unreadable" && !page.error) {
      issues.push(
        `coverage.pages.${page.page}: unreadable pages require an error`,
      );
    }
    for (const chunkId of page.chunkIds) {
      if (!knownChunks.has(chunkId)) {
        issues.push(`coverage.pages.${page.page}: unknown chunk ${chunkId}`);
      }
      if (
        page.status === "unreadable" &&
        chunkStatus.get(chunkId) !== "unreadable"
      ) {
        issues.push(
          `coverage.pages.${page.page}: unreadable pages may reference only unreadable chunks`,
        );
      }
    }
  }

  for (const chunk of manifest.coverage.chunks) {
    if (chunk.pageEnd < chunk.pageStart) {
      issues.push(`${chunk.chunkId}: pageEnd cannot precede pageStart`);
    }
    if (chunk.status === "unreadable" && !chunk.error) {
      issues.push(`${chunk.chunkId}: unreadable chunks require an error`);
    }
    if (chunk.status === "unreadable" && chunk.candidateIds.length) {
      issues.push(
        `${chunk.chunkId}: unreadable chunks cannot declare candidates`,
      );
    }
    for (const candidateId of chunk.candidateIds) {
      if (!knownCandidates.has(candidateId)) {
        issues.push(`${chunk.chunkId}: unknown candidate ${candidateId}`);
      }
    }
  }

  for (const candidate of manifest.candidates) {
    for (const occurrence of candidate.occurrences) {
      if (!knownChunks.has(occurrence.chunkId)) {
        issues.push(
          `${candidate.candidateId}: occurrence references unknown chunk ${occurrence.chunkId}`,
        );
      }
      if (chunkStatus.get(occurrence.chunkId) === "unreadable") {
        issues.push(
          `${candidate.candidateId}: cannot use an unreadable chunk as evidence`,
        );
      }
      if (occurrence.page > manifest.source.totalPages) {
        issues.push(
          `${candidate.candidateId}: occurrence page is out of range`,
        );
      }
    }
    if (isSenseAwareManifest(manifest) && "senseEvidence" in candidate) {
      const evidenceSentence = normalizedText(candidate.senseEvidence.sentence);
      const occurrenceSentences = candidate.occurrences.map((occurrence) =>
        normalizedText(occurrence.sentence),
      );
      if (!occurrenceSentences.includes(evidenceSentence)) {
        issues.push(
          `${candidate.candidateId}: senseEvidence.sentence must be one of the recorded source occurrences`,
        );
      }
    }
  }

  const recomputed = manifest.candidates.reduce(
    (counts, candidate) => {
      counts.totalCandidates += 1;
      counts[candidate.decision] += 1;
      if (candidate.usageFrequency === "heavy") counts.heavyUse += 1;
      if (candidate.usageFrequency === "medium") counts.mediumUse += 1;
      return counts;
    },
    {
      totalCandidates: 0,
      generate: 0,
      existing: 0,
      filtered: 0,
      rejected: 0,
      heavyUse: 0,
      mediumUse: 0,
    },
  );
  if (JSON.stringify(recomputed) !== JSON.stringify(manifest.counts)) {
    issues.push("counts: declared totals do not match the candidate ledger");
  }

  const planned = manifest.generationPlan.batches.flatMap(
    (batch) => batch.candidateIds,
  );
  const expectedGenerated = manifest.candidates
    .filter((candidate) => candidate.decision === "generate")
    .map((candidate) => candidate.candidateId)
    .sort();
  if (
    JSON.stringify([...planned].sort()) !== JSON.stringify(expectedGenerated)
  ) {
    issues.push(
      "generationPlan: batches must contain every generate candidate exactly once",
    );
  }
  if (duplicates(planned).length) {
    issues.push(
      "generationPlan: a candidate cannot appear in multiple batches",
    );
  }
  const expectedBatchNumbers = manifest.generationPlan.batches.map(
    (_, index) => index + 1,
  );
  if (
    JSON.stringify(
      manifest.generationPlan.batches.map((batch) => batch.batchNumber),
    ) !== JSON.stringify(expectedBatchNumbers)
  ) {
    issues.push("generationPlan: batch numbers must be continuous from 1");
  }
  for (const batch of manifest.generationPlan.batches) {
    if (batch.candidateIds.length > manifest.generationPlan.batchSize) {
      issues.push(
        `generationPlan.${batch.batchNumber}: exceeds the declared batch size`,
      );
    }
  }

  return {
    valid: issues.length === 0,
    value: manifest,
    issues,
    hash: contentPackHash(manifest),
  };
}

export function validateContentBatch(
  raw: unknown,
  manifest?: ContentManifest,
): PackValidationResult<ContentBatch> {
  const parsed = ContentBatchSchema.safeParse(raw);
  if (!parsed.success)
    return { valid: false, issues: schemaIssues(parsed.error) };
  const batch = parsed.data;
  const issues: string[] = [];
  const entryCandidateIds = batch.entries.map((entry) => entry.candidateId);
  if (duplicates(entryCandidateIds).length) {
    issues.push("entries: candidate IDs must be unique within a batch");
  }

  if (manifest) {
    const compatibleVersions =
      (manifest.formatVersion === LEGACY_CONTENT_MANIFEST_VERSION &&
        batch.formatVersion === LEGACY_CONTENT_BATCH_VERSION) ||
      (manifest.formatVersion === SENSE_AWARE_CONTENT_MANIFEST_VERSION &&
        batch.formatVersion === SENSE_AWARE_CONTENT_BATCH_VERSION) ||
      (manifest.formatVersion === CONTENT_MANIFEST_VERSION &&
        batch.formatVersion === CONTENT_BATCH_VERSION);
    if (!compatibleVersions) {
      issues.push("formatVersion: manifest and batch contract versions differ");
    }
    const manifestHash = contentPackHash(manifest);
    if (batch.manifestId !== manifest.manifestId) {
      issues.push("manifestId: does not match the manifest");
    }
    if (batch.manifestHash !== manifestHash) {
      issues.push("manifestHash: does not match the immutable manifest");
    }
    const plan = manifest.generationPlan.batches.find(
      (item) => item.batchNumber === batch.batchNumber,
    );
    if (!plan) {
      issues.push("batchNumber: is not present in the generation plan");
    } else if (
      JSON.stringify([...entryCandidateIds].sort()) !==
      JSON.stringify([...plan.candidateIds].sort())
    ) {
      issues.push(
        "entries: candidate IDs do not exactly match the planned batch",
      );
    }

    const candidates = new Map(
      manifest.candidates.map((candidate) => [
        candidate.candidateId,
        candidate,
      ]),
    );
    for (const entry of batch.entries) {
      const candidate = candidates.get(entry.candidateId);
      if (!candidate || candidate.decision !== "generate") {
        issues.push(
          `${entry.candidateId}: is not an approved generation candidate`,
        );
        continue;
      }
      if (
        entry.word.trim().toLowerCase() !== candidate.term.trim().toLowerCase()
      ) {
        issues.push(
          `${entry.candidateId}: word does not match the assessed term`,
        );
      }
      if (
        isSenseAwareManifest(manifest) &&
        /\s+\([A-Z]{1,3}\)$/.test(entry.word.trim())
      ) {
        issues.push(
          `${entry.candidateId}: word must contain the real unsuffixed term; the app assigns the sense label`,
        );
      }
      if (
        isSenseAwareManifest(manifest) &&
        "senseEvidence" in candidate &&
        candidate.contextualMeaning
      ) {
        if (
          normalizedText(entry.englishMeaning) !==
          normalizedText(candidate.contextualMeaning)
        ) {
          issues.push(
            `${entry.candidateId}: English meaning must equal the assessed contextual meaning`,
          );
        }
        if (
          normalizedText(entry.lesson.meaning_in_context.contextual_meaning) !==
          normalizedText(candidate.contextualMeaning)
        ) {
          issues.push(
            `${entry.candidateId}: lesson contextual meaning must equal the assessed contextual meaning`,
          );
        }
        if (
          normalizedText(entry.lesson.meaning_in_context.source_sentence) !==
          normalizedText(candidate.senseEvidence.sentence)
        ) {
          issues.push(
            `${entry.candidateId}: lesson source sentence must equal the assessed sense evidence`,
          );
        }
      }
      try {
        assertVocabularyLessonCompliant(entry.lesson, candidate.term);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  return {
    valid: issues.length === 0,
    value: batch,
    issues,
    hash: contentPackHash(batch),
  };
}

export function parseContentPack(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error("The content pack is not valid JSON.");
  }
}
