import { createHash } from "crypto";
import { z } from "zod";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().min(3).max(140).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
const note = z.string().trim().min(8).max(10000);
const nullableText = z.string().nullable();
const sourceRecord = z.object({
  wordId: z.number().int(), rank: z.number().int().nullable(),
  personalRank: z.number().int().nullable(), text: nullableText,
  otherForms: nullableText, primaryMeaning: nullableText,
  primarySenseId: nullableText, type: z.number().int().nullable(),
  britishPhonetic: nullableText, americanPhonetic: nullableText,
}).strict();

export const CatalogueEvidenceSchema = z.object({
  recordIds: z.array(id).min(1).max(100000),
  meaningOrigin: z.enum(["supplied_definition", "additional_meaning"]),
  exampleOrigin: z.literal("authored_for_learning"),
  levelReason: note,
  usageReason: note,
  assessmentBasis: z.enum(["linguistic_assessment", "referenced_assessment"]),
  references: z.array(z.object({
    url: z.string().url().refine(value => /^https?:\/\//.test(value)),
    supports: z.enum(["meaning", "level", "usage"]),
    explanation: note,
  }).strict()).max(30),
}).strict();

export const CatalogueAuditSchema = z.object({
  preparation: z.object({
    formatVersion: z.literal("wordup-catalogue-preparation-v1"),
    source: z.object({ sha256: hash, table: z.literal("words"), recordCount: z.number().int().positive() }).strict(),
    policy: z.object({
      includedCefrLevels: z.tuple([z.literal("B1"), z.literal("B2"), z.literal("C1")]),
      includedFrequencies: z.tuple([z.literal("heavy"), z.literal("medium")]),
      evidenceType: z.literal("catalogue_definition"),
      teachingExampleOrigin: z.literal("authored_for_learning"),
      sourceSentenceAvailable: z.literal(false),
      rankIsLevelOrFrequencyEvidence: z.literal(false),
      importSourceLearningState: z.literal(false),
      existingVocabularyCheck: z.literal("required_in_local_app"),
    }).strict(),
    records: z.array(z.object({
      recordId: id, recordHash: hash, source: sourceRecord,
      evidenceType: z.literal("catalogue_definition"), flags: z.array(z.string()),
    }).strict()).min(1).max(100000),
    assessmentGroups: z.array(z.object({ groupId: id, recordIds: z.array(id).min(1).max(100) }).strict()).min(1).max(100000),
    audit: z.object({
      records: z.number().int().positive(), groupedRecords: z.number().int().positive(), untracked: z.literal(0),
      words: z.number().int().nonnegative(), expressions: z.number().int().nonnegative(), unknownTypes: z.number().int().nonnegative(),
      flagCounts: z.record(z.number().int().nonnegative()),
    }).strict(),
    preparationHash: hash,
  }).strict(),
  recordReviews: z.array(z.object({
    recordId: id,
    // Basic primary definitions cannot exclude an entire headword. Review its
    // other senses too; only malformed/name records may have no candidates.
    status: z.enum(["assessed", "rejected"]),
    rejectionCode: z.enum(["noise", "malformed_record", "proper_name"]).optional(),
    candidateIds: z.array(id).max(1000),
    additionalMeaningsReviewed: z.literal(true),
    reason: note,
  }).strict()).min(1).max(100000),
}).strict();

// The Python preparation tool uses ordinal key sorting, not localeCompare.
export function catalogueHash(value: unknown): string {
  const canonical = (item: any): string => Array.isArray(item)
    ? `[${item.map(canonical).join(",")}]`
    : item && typeof item === "object"
      ? `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${canonical(item[key])}`).join(",")}}`
      : JSON.stringify(item);
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function catalogueAuditIssues(audit: z.infer<typeof CatalogueAuditSchema>, candidates: any[], sourceHash: string): string[] {
  const issues: string[] = [];
  const { preparation, recordReviews } = audit;
  const { preparationHash, ...payload } = preparation;
  const records = new Map(preparation.records.map(record => [record.recordId, record]));
  const reviews = new Map(recordReviews.map(review => [review.recordId, review]));
  const meanings = new Map(candidates.map(candidate => [candidate.candidateId, candidate]));
  const normalize = (term: string) => term.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const unique = (items: string[]) => new Set(items).size === items.length;
  if (catalogueHash(payload) !== preparationHash) issues.push("catalogue: preparation hash mismatch");
  if (preparation.source.sha256 !== sourceHash) issues.push("catalogue: source hash mismatch");
  if (records.size !== preparation.records.length) issues.push("catalogue: duplicate record IDs");
  if (reviews.size !== recordReviews.length) issues.push("catalogue: duplicate record reviews");
  if (reviews.size !== records.size || [...records.keys()].some(key => !reviews.has(key)) || [...reviews.keys()].some(key => !records.has(key))) {
    issues.push("catalogue: review every prepared record exactly once");
  }
  const expectedCounts = {
    records: records.size, groupedRecords: records.size, untracked: 0,
    words: preparation.records.filter(record => record.source.type === 1).length,
    expressions: preparation.records.filter(record => record.source.type === 2).length,
    unknownTypes: preparation.records.filter(record => ![1, 2].includes(record.source.type!)).length,
    flagCounts: {} as Record<string, number>,
  };
  for (const record of preparation.records) {
    if (record.recordHash !== catalogueHash(record.source)) issues.push(`${record.recordId}: source record hash mismatch`);
    if (record.recordId !== `wordup-${sourceHash.slice(0, 16)}-${record.source.wordId}`) issues.push(`${record.recordId}: record identity mismatch`);
    for (const flag of record.flags) expectedCounts.flagCounts[flag] = (expectedCounts.flagCounts[flag] || 0) + 1;
  }
  if (preparation.source.recordCount !== records.size || catalogueHash(expectedCounts) !== catalogueHash(preparation.audit)) {
    issues.push("catalogue: preparation counts do not reconcile");
  }
  const grouped = preparation.assessmentGroups.flatMap(group => group.recordIds);
  if (!unique(preparation.assessmentGroups.map(group => group.groupId)) || !unique(grouped) || grouped.length !== records.size || grouped.some(key => !records.has(key))) {
    issues.push("catalogue: groups must partition all prepared records exactly once");
  }
  if (records.size > 100 && preparation.assessmentGroups.some(group => group.recordIds.length < 50)) issues.push("catalogue: large-source groups must contain 50–100 records");
  for (const review of recordReviews) {
    if (!unique(review.candidateIds)) issues.push(`${review.recordId}: duplicate candidate links`);
    if (review.status === "assessed" && !review.candidateIds.length) issues.push(`${review.recordId}: assessed records need meaning decisions`);
    if (review.status === "rejected" && review.candidateIds.length) issues.push(`${review.recordId}: rejected records cannot link meanings`);
    if (review.status === "rejected" && !review.rejectionCode) issues.push(`${review.recordId}: whole-record rejection requires noise, malformed_record or proper_name; assess other senses before excluding a basic word`);
    if (review.status === "assessed" && review.rejectionCode) issues.push(`${review.recordId}: assessed records cannot carry a rejection code`);
    for (const key of review.candidateIds) {
      if (!meanings.get(key)?.catalogueEvidence.recordIds.includes(review.recordId)) issues.push(`${review.recordId}: candidate link is missing or not reciprocal`);
    }
    if (review.status === "assessed" && !review.candidateIds.some(key => meanings.get(key)?.catalogueEvidence.meaningOrigin === "supplied_definition")) {
      issues.push(`${review.recordId}: the supplied definition needs an explicit decision too`);
    }
  }
  for (const candidate of candidates) {
    const evidence = candidate.catalogueEvidence;
    if (!unique(evidence.recordIds)) issues.push(`${candidate.candidateId}: duplicate record references`);
    for (const key of evidence.recordIds) {
      const record = records.get(key);
      if (!record || !reviews.get(key)?.candidateIds.includes(candidate.candidateId)) issues.push(`${candidate.candidateId}: unbound catalogue record`);
      if (record && normalize(record.source.text || "") !== normalize(candidate.term)) issues.push(`${candidate.candidateId}: term differs from the supplied word or complete expression`);
    }
    if (evidence.meaningOrigin === "supplied_definition" && !evidence.recordIds.some((key: string) => records.get(key)?.source.primaryMeaning === candidate.contextualMeaning)) {
      issues.push(`${candidate.candidateId}: supplied definition must be preserved exactly`);
    }
    if (evidence.meaningOrigin === "additional_meaning" && !evidence.references.some((reference: any) => reference.supports === "meaning")) {
      issues.push(`${candidate.candidateId}: additional meanings need an explicit meaning reference`);
    }
    if (evidence.assessmentBasis === "referenced_assessment" && ["level", "usage"].some(claim => !evidence.references.some((reference: any) => reference.supports === claim))) {
      issues.push(`${candidate.candidateId}: referenced assessments need references for both level and usage`);
    }
    if (candidate.decision === "generate" && !["B1", "B2", "C1"].includes(candidate.cefrLevel)) issues.push(`${candidate.candidateId}: catalogue generation accepts B1–C1 only`);
    if (candidate.decision === "existing" && !candidate.matchedWordId) issues.push(`${candidate.candidateId}: existing requires a stored word identity`);
    if (candidate.decision !== "rejected" && (!candidate.cefrLevel || !candidate.usageFrequency)) issues.push(`${candidate.candidateId}: each assessed meaning needs its own level and usage band`);
  }
  return issues;
}
