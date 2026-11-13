import { createHash } from "crypto";
import { z } from "zod";
import { CatalogueUsageTypeSchema } from "../data/vocabulary-lesson-template";

import { ResolvedDeliverySchema, subsetAccountingIssues, parentLedgerHash } from "./catalogue-subset-accounting";

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

export const CATALOGUE_SELECTION_POLICY_ID = "wordup-useful-b1-c2-20261024" as const;
export const CatalogueSelectionPolicySchema = z.object({
  policyId: z.literal(CATALOGUE_SELECTION_POLICY_ID),
  eligibleLevels: z.tuple([z.literal("B1"), z.literal("B2"), z.literal("C1"), z.literal("C2")]),
  priorityLevels: z.tuple([z.literal("B2"), z.literal("C1"), z.literal("C2")]),
  includedFrequencies: z.tuple([z.literal("heavy"), z.literal("medium")]),
  excludeBasicObvious: z.literal(true),
  excludePredictableCombinations: z.literal(true),
  excludeRareSpecialist: z.literal(true),
  preserveNonObviousExpressions: z.literal(true),
  expandBasicHeadwords: z.literal(false),
}).strict();

export const CatalogueEvidenceSchema = z.object({
  supportedUsageTypes: z.array(CatalogueUsageTypeSchema).min(1).max(3)
    .refine(types => new Set(types).size === types.length, "usage types must be unique").optional(),
  usageTypeReason: note.optional(),
  recordIds: z.array(id).min(1).max(100000),
  meaningOrigin: z.enum(["supplied_definition", "additional_meaning"]),
  exampleOrigin: z.literal("authored_for_learning"),
  learningValue: z.enum(["non_obvious", "basic_obvious", "predictable_combination", "rare_specialist"]),
  learningValueReason: note,
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
  resolvedDelivery: ResolvedDeliverySchema.optional(),
  deliveryGroup: z.object({
    policyId: z.literal("wordup-delivery-groups-v1"),
    ownerUserId: z.string().uuid(),
    groupNumber: z.number().int().positive(),
    assessmentGroupIds: z.array(id).min(1).max(10),
    previousGroup: z.object({ manifestId: id, manifestHash: hash }).strict().nullable(),
  }).strict().optional(),
  examplePolicy: z.literal("catalogue-usage-types-v1").optional(),
  // Current selection is separate from the immutable historical preparation.
  selectionPolicy: CatalogueSelectionPolicySchema,
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
    status: z.enum(["assessed", "rejected", "scope_excluded"]),
    scopeExclusionCode: z.enum(["basic_obvious", "predictable_combination"]).optional(),
    rejectionCode: z.enum(["noise", "malformed_record", "proper_name"]).optional(),
    candidateIds: z.array(id).max(1000),
    additionalMeaningsReviewed: z.boolean(),
    reason: note,
  }).strict()).min(1).max(100000),
}).strict();

export type CatalogueAudit = z.infer<typeof CatalogueAuditSchema>;

/** Preserve original assessment IDs/order; never repartition source records. */
export function catalogueAssessmentGroups(audit: CatalogueAudit) {
  const groups = audit.preparation.assessmentGroups;
  if (audit.resolvedDelivery) {
    const offset = (audit.resolvedDelivery.cycleNumber - 1) * 5;
    return groups.slice(offset, offset + 5);
  }
  if (!audit.deliveryGroup) return groups;
  const offset = (audit.deliveryGroup.groupNumber - 1) * 10;
  return groups.slice(offset, offset + 10);
}

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
  const selectedGroups = catalogueAssessmentGroups(audit);
  const selectedRecords = new Set(selectedGroups.flatMap(group => group.recordIds));
  const subset = audit.resolvedDelivery;
  if (subset) {
    if (!audit.deliveryGroup) issues.push("catalogue: resolved delivery requires an owner-bound delivery group");
    issues.push(...subsetAccountingIssues(subset.parent, subset.selection, {ownerUserId: audit.deliveryGroup?.ownerUserId || "", sourceHash, preparationHash, groupNumber: Math.ceil(subset.cycleNumber / 2), records: selectedGroups.flatMap(g => g.recordIds).map(id => records.get(id)!)}));
    const ids = candidates.map(c => c.candidateId);
    const same = (a: string[], b: string[]) => unique(a) && unique(b) && a.length === b.length && a.every(x => b.includes(x));
    if (!same(ids, subset.candidateIds)) issues.push("catalogue: delivery candidate membership differs from immutable selection");
    if (subset.kind === "base" && (!same(ids, [...subset.selection.included, ...subset.selection.excluded]) || subset.baseManifest || subset.previousSupplement || (subset.cycleNumber === 1) !== (subset.previousBase === null))) issues.push("catalogue: invalid resolved base membership or dependencies");
    if (subset.kind === "supplement" && (!subset.baseManifest || !ids.length)) issues.push("catalogue: supplement requires its base and resolved candidates");
    if (audit.deliveryGroup?.groupNumber !== Math.ceil(subset.cycleNumber / 2)) issues.push("catalogue: cycle must retain original parent group");
    const parentCandidates = new Map(subset.parent.candidates.map(c => [c.candidateId, c]));
    for (const c of candidates) {
      const parent = parentCandidates.get(c.candidateId);
      const identity = `${normalize(c.term)}|${normalize(c.senseKey)}`;
      if (!parent || parent.evidenceHash !== parentLedgerHash(c) || parent.senseIdentity !== identity || !same(parent.recordIds, c.catalogueEvidence.recordIds) || parent.disposition !== (["generate", "existing"].includes(c.decision) ? "resolved" : "excluded")) issues.push(`${c.candidateId}: candidate differs from parent decision/evidence`);
    }
    for (const review of recordReviews) {
      const parent = subset.parent.records.find(r => r.recordId === review.recordId);
      if (!parent || !same(review.candidateIds, parent.candidateIds.filter(id => ids.includes(id))) || (parent.rejection ? review.status !== "rejected" || parent.rejection.code !== review.rejectionCode : review.status === "rejected")) issues.push(`${review.recordId}: record review differs from parent accounting`);
    }
  }
  if (audit.deliveryGroup) {
    const group = audit.deliveryGroup;
    if (audit.examplePolicy !== "catalogue-usage-types-v1") issues.push("catalogue: delivery groups require the usage-type example policy");
    if (!selectedGroups.length || JSON.stringify(group.assessmentGroupIds) !== JSON.stringify(selectedGroups.map(item => item.groupId))) {
      issues.push("catalogue: delivery group must select its exact ordered original assessment groups");
    }
    if (preparation.assessmentGroups.some((item, index) => item.recordIds.length !== 100 && index !== preparation.assessmentGroups.length - 1)) {
      issues.push("catalogue: delivery groups require original 100-record assessment groups, with only the last allowed shorter");
    }
    if (!subset && (group.groupNumber === 1) !== (group.previousGroup === null)) issues.push("catalogue: only the first delivery group may omit its predecessor");
    // A bounded ambiguity exclusion is a final accounting decision, not a lesson.
    // Keep unresolved/generated senses blocked; the shared manifest validator
    // still checks complete coverage and excludes filtered IDs from batch plans.
    if (candidates.some(candidate => candidate.senseDecision === "ambiguous" &&
        !(candidate.decision === "filtered" && !candidate.matchedWordId &&
          /^ambiguous_context:\s+\S/.test(candidate.reason ?? "")))) {
      issues.push("catalogue: ambiguous meanings require a final filtered ambiguous_context: explanation before freezing a delivery group");
    }
    if (candidates.some(candidate => candidate.decision === "generate" &&
        (candidate.senseDecision !== "new_sense" || candidate.operation !== "new" || candidate.matchedWordId))) {
      issues.push("catalogue: delivery groups generate new senses only; preserve existing senses through existing decisions");
    }
  }
  if (catalogueHash(payload) !== preparationHash) issues.push("catalogue: preparation hash mismatch");
  if (preparation.source.sha256 !== sourceHash) issues.push("catalogue: source hash mismatch");
  if (records.size !== preparation.records.length) issues.push("catalogue: duplicate record IDs");
  if (reviews.size !== recordReviews.length) issues.push("catalogue: duplicate record reviews");
  if (reviews.size !== selectedRecords.size || [...selectedRecords].some(key => !reviews.has(key)) || [...reviews.keys()].some(key => !selectedRecords.has(key))) {
    issues.push("catalogue: review every prepared record in the selected scope exactly once");
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
    if (!subset && review.status !== "rejected" && !review.candidateIds.length) issues.push(`${review.recordId}: assessed records need meaning decisions`);
    if (review.status === "rejected" && review.candidateIds.length) issues.push(`${review.recordId}: rejected records cannot link meanings`);
    if (review.status === "rejected" && !review.rejectionCode) issues.push(`${review.recordId}: whole-record rejection requires noise, malformed_record or proper_name`);
    if (review.status !== "rejected" && review.rejectionCode) issues.push(`${review.recordId}: assessed records cannot carry a rejection code`);
    if (review.status === "scope_excluded") {
      if (!review.scopeExclusionCode || review.additionalMeaningsReviewed) issues.push(`${review.recordId}: scope exclusion needs a code and must not claim exhaustive sense review`);
      if (review.candidateIds.some(key => meanings.get(key)?.decision !== "filtered")) issues.push(`${review.recordId}: scope-excluded meanings must remain filtered`);
      if (review.candidateIds.some(key => !["basic_obvious", "predictable_combination"].includes(meanings.get(key)?.catalogueEvidence.learningValue))) issues.push(`${review.recordId}: do not scope-exclude a non-obvious expression or sense`);
    } else {
      if (review.scopeExclusionCode) issues.push(`${review.recordId}: scope code requires scope_excluded status`);
      if (!subset && review.status === "assessed" && !review.additionalMeaningsReviewed) issues.push(`${review.recordId}: assessed records require completed useful-sense review`);
    }
    for (const key of review.candidateIds) {
      if (!meanings.get(key)?.catalogueEvidence.recordIds.includes(review.recordId)) issues.push(`${review.recordId}: candidate link is missing or not reciprocal`);
    }
    if (!subset && review.status !== "rejected" && !review.candidateIds.some(key => meanings.get(key)?.catalogueEvidence.meaningOrigin === "supplied_definition")) {
      issues.push(`${review.recordId}: the supplied definition needs an explicit decision too`);
    }
  }
  for (const candidate of candidates) {
    const evidence = candidate.catalogueEvidence;
    if (audit.examplePolicy && candidate.decision === "generate" &&
        (!evidence.supportedUsageTypes?.length || !evidence.usageTypeReason)) {
      issues.push(`${candidate.candidateId}: usage-type policy requires supported types and a sense-specific reason`);
    }
    if (!audit.examplePolicy && (evidence.supportedUsageTypes || evidence.usageTypeReason)) {
      issues.push(`${candidate.candidateId}: usage-type evidence requires the catalogue example policy`);
    }
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
    if (candidate.decision === "generate" && !["B1", "B2", "C1", "C2"].includes(candidate.cefrLevel)) issues.push(`${candidate.candidateId}: catalogue generation accepts B1–C2 only`);
    if (candidate.decision === "generate" && evidence.learningValue !== "non_obvious") issues.push(`${candidate.candidateId}: basic, predictable or rare specialist meanings must be filtered regardless of level`);
    if (candidate.decision === "generate" && !["heavy", "medium"].includes(candidate.usageFrequency)) issues.push(`${candidate.candidateId}: catalogue generation requires heavy/medium usefulness`);
    if (candidate.decision === "existing" && !candidate.matchedWordId) issues.push(`${candidate.candidateId}: existing requires a stored word identity`);
    if (candidate.decision !== "rejected" && (!candidate.cefrLevel || !candidate.usageFrequency)) issues.push(`${candidate.candidateId}: each assessed meaning needs its own level and usage band`);
  }
  return issues;
}


