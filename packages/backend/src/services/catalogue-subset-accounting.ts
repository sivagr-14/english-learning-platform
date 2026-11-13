import { createHash } from 'crypto';

/** Draft accounting primitive only. Not accepted by the production manifest schema.
 * Integration must retain legacy gates until PostgreSQL supplement tests pass. */
export interface ParentCandidate {
  candidateId: string;
  recordIds: string[];
  senseIdentity: string;
  disposition: 'resolved' | 'excluded' | 'deferred';
  evidenceHash: string;
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
