import { createHash } from 'crypto';

/** Draft accounting primitive only. Not accepted by the production manifest schema.
 * Integration must retain legacy gates until PostgreSQL supplement tests pass. */
export interface ParentCandidate {
  candidateId: string;
  recordIds: string[];
  senseIdentity: string;
  disposition: 'resolved' | 'excluded' | 'deferred';
  evidenceHash: string;
  review?: {
    reviewId: string;
    reason: 'ambiguity' | 'eligibility' | 'expression_boundary' | 'taxonomy' | 'duplicate_identity' | 'lesson_quality';
    missingFields: string[];
    attempts: Array<{kind: 'substantive' | 'targeted_retry'; at: string; evidenceHash: string; outcome: string}>;
    dependency: string;
    nextAction: string;
  };
}
export interface ParentRecord {
  recordId: string;
  recordHash: string;
  candidateIds: string[];
  recallUnitIds: string[];
}
export interface ParentLedger {
  version: 'wordup-parent-ledger-v1';
  ownerUserId: string;
  sourceHash: string;
  preparationHash: string;
  groupNumber: number;
  revision: number;
  records: ParentRecord[];
  candidates: ParentCandidate[];
  recallUnits: Array<{unitId: string; recordId: string; disposition: 'resolved' | 'deferred'; evidenceHash: string}>;
}
export interface SubsetSelection {
  version: 'wordup-resolved-selection-v1';
  parentHash: string;
  included: string[];
  excluded: string[];
  deferred: string[];
}

export function parentLedgerHash(value: unknown): string {
  const canonical = (item: any): string => Array.isArray(item)
    ? `[${item.map(canonical).join(',')}]`
    : item && typeof item === 'object'
      ? `{${Object.keys(item).sort().map(key => `${JSON.stringify(key)}:${canonical(item[key])}`).join(',')}}`
      : JSON.stringify(item);
  return createHash('sha256').update(canonical(value)).digest('hex');
}

/** `expected` comes from the immutable preparation and authenticated caller,
 * never from a subset's self-declared coverage. No state or learner rows mutate. */
export function subsetAccountingIssues(parent: ParentLedger, selection: SubsetSelection, expected: {
  ownerUserId: string; sourceHash: string; preparationHash: string; groupNumber: number;
  records: Array<{recordId: string; recordHash: string}>;
}): string[] {
  const issues: string[] = [];
  const unique = (values: string[]) => values.length === new Set(values).size;
  const equalSet = (a: string[], b: string[]) => unique(a) && unique(b) && a.length === b.length && a.every(x => b.includes(x));
  const hash = (s: string) => /^[a-f0-9]{64}$/.test(s);
  if (parent.version !== 'wordup-parent-ledger-v1' || selection.version !== 'wordup-resolved-selection-v1') issues.push('Unsupported accounting version.');
  for (const field of ['ownerUserId', 'sourceHash', 'preparationHash', 'groupNumber'] as const) {
    if (parent[field] !== expected[field]) issues.push(`Parent ${field} differs from trusted binding.`);
  }
  if (!Number.isSafeInteger(parent.revision) || parent.revision < 1) issues.push('Parent revision must be positive.');
  if (!Number.isSafeInteger(parent.groupNumber) || parent.groupNumber < 1) issues.push('Parent group number must be positive.');
  if (!hash(parent.sourceHash) || !hash(parent.preparationHash)) issues.push('Invalid source or preparation hash.');
  if (selection.parentHash !== parentLedgerHash(parent)) issues.push('Parent ledger hash mismatch.');
  const records = new Map(parent.records.map(r => [r.recordId, r]));
  const candidates = new Map(parent.candidates.map(c => [c.candidateId, c]));
  const units = new Map(parent.recallUnits.map(u => [u.unitId, u]));
  if (!equalSet(parent.records.map(r => r.recordId), expected.records.map(r => r.recordId))) issues.push('Parent must account for every prepared group record exactly once.');
  if (parent.records.some((r, i) => r.recordId !== expected.records[i]?.recordId)) issues.push('Parent must preserve original prepared record order.');
  if (candidates.size !== parent.candidates.length) issues.push('Duplicate parent candidate.');
  if (units.size !== parent.recallUnits.length) issues.push('Duplicate recall unit.');
  if (new Set(parent.candidates.map(c => c.senseIdentity)).size !== parent.candidates.length) issues.push('Duplicate parent sense identity.');
  const reviewIds = parent.candidates.filter(c => c.review).map(c => c.review!.reviewId);
  if (!unique(reviewIds)) issues.push('Duplicate deferred review identity.');
  for (const r of expected.records) if (!hash(r.recordHash) || records.get(r.recordId)?.recordHash !== r.recordHash) issues.push(`${r.recordId}: source record hash mismatch.`);
  for (const r of parent.records) {
    if (!unique(r.candidateIds) || !unique(r.recallUnitIds)) issues.push(`${r.recordId}: duplicate coverage links.`);
    // Even a rejected/noise record needs explicit accounting before integration.
    if (!r.candidateIds.length || !r.recallUnitIds.length) issues.push(`${r.recordId}: missing candidate or recall accounting.`);
    for (const cid of r.candidateIds) if (!candidates.get(cid)?.recordIds.includes(r.recordId)) issues.push(`${r.recordId}: candidate link is not reciprocal.`);
    for (const uid of r.recallUnitIds) if (units.get(uid)?.recordId !== r.recordId) issues.push(`${r.recordId}: recall link is not reciprocal.`);
  }
  for (const c of parent.candidates) {
    if (!c.candidateId.trim() || !c.senseIdentity.trim() || !hash(c.evidenceHash)) issues.push(`${c.candidateId}: missing identity/evidence hash.`);
    if (!['resolved', 'excluded', 'deferred'].includes(c.disposition)) issues.push(`${c.candidateId}: invalid disposition.`);
    if (c.disposition === 'deferred') {
      const r = c.review;
      if (!r || !r.reviewId.trim() || !['ambiguity', 'eligibility', 'expression_boundary', 'taxonomy', 'duplicate_identity', 'lesson_quality'].includes(r.reason) ||
          !r.missingFields.length || r.missingFields.some(f => !f.trim()) || !unique(r.missingFields) ||
          r.dependency.trim().length < 3 || r.nextAction.trim().length < 8) {
        issues.push(`${c.candidateId}: deferred review needs identity, reason, missing fields, dependency and next action.`);
      }
      if (!r || r.attempts.length !== 2 || r.attempts[0]?.kind !== 'substantive' || r.attempts[1]?.kind !== 'targeted_retry' ||
          r.attempts.some(a => !Number.isFinite(Date.parse(a.at)) || !hash(a.evidenceHash) || a.outcome.trim().length < 8) ||
          Date.parse(r.attempts[1]?.at) < Date.parse(r.attempts[0]?.at)) {
        issues.push(`${c.candidateId}: defer only after a recorded substantive attempt and targeted retry.`);
      }
    }
    if (!c.recordIds.length || !unique(c.recordIds)) issues.push(`${c.candidateId}: invalid record membership.`);
    for (const rid of c.recordIds) if (!records.get(rid)?.candidateIds.includes(c.candidateId)) issues.push(`${c.candidateId}: unbound source record.`);
  }
  for (const u of parent.recallUnits) {
    if (!u.unitId.trim() || !hash(u.evidenceHash) || !['resolved', 'deferred'].includes(u.disposition)) issues.push(`${u.unitId}: invalid recall evidence/disposition.`);
    if (!records.get(u.recordId)?.recallUnitIds.includes(u.unitId)) issues.push(`${u.unitId}: unbound recall unit.`);
  }
  const membership = [...selection.included, ...selection.excluded, ...selection.deferred];
  if (!equalSet(membership, parent.candidates.map(c => c.candidateId))) issues.push('Selection must partition all parent candidates without overlap or omissions.');
  for (const [field, disposition] of [['included', 'resolved'], ['excluded', 'excluded'], ['deferred', 'deferred']] as const) {
    for (const cid of selection[field]) if (candidates.get(cid)?.disposition !== disposition) issues.push(`${cid}: selection disagrees with parent disposition.`);
  }
  for (const cid of selection.included) {
    for (const rid of candidates.get(cid)?.recordIds || []) {
      if (records.get(rid)?.recallUnitIds.some(uid => units.get(uid)?.disposition !== 'resolved')) issues.push(`${cid}: included candidate has unresolved source recall.`);
    }
  }
  return [...new Set(issues)];
}
