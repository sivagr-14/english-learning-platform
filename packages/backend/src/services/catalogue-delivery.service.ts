import { ContentManifest, contentPackHash, CATALOGUE_CONTENT_MANIFEST_VERSION } from './content-pack-contract';
import { parentLedgerHash } from './catalogue-subset-accounting';
import { readJson } from '../utils/json';

export function catalogueDeliveryGroup(manifest: ContentManifest) {
  return manifest.formatVersion === CATALOGUE_CONTENT_MANIFEST_VERSION ? manifest.catalogueAudit.deliveryGroup : undefined;
}

/** Keep other sources in place, but drain each catalogue in source order. */
export function orderCatalogueDeliveryRows<T extends {payload?: unknown}>(rows: T[]): T[] {
  const result = [...rows];
  const positions = new Map<string, Array<{index: number; row: T; number: number}>>();
  rows.forEach((row, index) => {
    const manifest = readJson<ContentManifest | null>(row.payload, null);
    const group = manifest && catalogueDeliveryGroup(manifest);
    if (!manifest || !group) return;
    const key = `${group.ownerUserId}:${manifest.source.contentHash}`;
    positions.set(key, [...(positions.get(key) || []), {index, row, number: manifest.formatVersion === CATALOGUE_CONTENT_MANIFEST_VERSION && manifest.catalogueAudit.resolvedDelivery ? manifest.catalogueAudit.resolvedDelivery.cycleNumber + (manifest.catalogueAudit.resolvedDelivery.kind === "supplement" ? 0.5 : 0) : group.groupNumber}]);
  });
  for (const entries of positions.values()) {
    const ordered = [...entries].sort((a, b) => a.number - b.number);
    entries.forEach((entry, index) => { result[entry.index] = ordered[index].row; });
  }
  return result;
}

export interface ClaimedCatalogueGroup {
  manifest: ContentManifest;
  manifestHash: string;
  status: string;
  verifiedAt: unknown;
  verification: {verified?: boolean; entries?: number; issues?: string[]};
}

/** Checks app-owned receipts, never receipt claims supplied in a content pack. */
export function catalogueGroupClaimIssues(manifest: ContentManifest, ownerUserId: string, claimed: ClaimedCatalogueGroup[]): string[] {
  if (manifest.formatVersion !== CATALOGUE_CONTENT_MANIFEST_VERSION) return [];
  if (manifest.catalogueAudit.resolvedDelivery) return resolvedDeliveryClaimIssues(manifest, ownerUserId, claimed);
  if (claimed.some(item => item.manifest.source.contentHash === manifest.source.contentHash && resolvedDelivery(item.manifest))) return ['Catalogue source already uses resolved delivery; legacy claims cannot replace it.'];
  const group = catalogueDeliveryGroup(manifest);
  const prior = claimed.filter(item => item.manifest.source.contentHash === manifest.source.contentHash);
  if (!group) return prior.some(item => catalogueDeliveryGroup(item.manifest)) ? ['Catalogue source already uses immutable delivery groups.'] : [];
  const issues: string[] = [];
  if (group.ownerUserId !== ownerUserId) issues.push('Catalogue delivery group belongs to another account.');
  const ordered = prior.sort((a, b) => (catalogueDeliveryGroup(a.manifest)?.groupNumber || 0) - (catalogueDeliveryGroup(b.manifest)?.groupNumber || 0));
  if (ordered.length !== group.groupNumber - 1) issues.push('Claim only the first missing catalogue delivery group.');
  const usedCandidates = new Set<string>();
  for (const [index, item] of ordered.entries()) {
    const previous = catalogueDeliveryGroup(item.manifest);
    if (!previous || previous.groupNumber !== index + 1 || previous.ownerUserId !== ownerUserId ||
        item.manifest.formatVersion !== CATALOGUE_CONTENT_MANIFEST_VERSION ||
        item.manifest.catalogueAudit.preparation.preparationHash !== manifest.catalogueAudit.preparation.preparationHash) {
      issues.push('Catalogue group history has a gap, duplicate, owner mismatch or changed preparation.');
    }
    if (item.manifestHash !== contentPackHash(item.manifest)) issues.push('Stored catalogue manifest hash does not match its immutable payload.');
    const generated = item.manifest.candidates.filter(candidate => candidate.decision === 'generate').length;
    if (item.status !== 'completed' || !item.verifiedAt || item.verification.verified !== true ||
        item.verification.entries !== generated || !Array.isArray(item.verification.issues) || item.verification.issues.length !== 0) {
      issues.push('Every earlier catalogue group requires a complete PostgreSQL read-back receipt.');
    }
    item.manifest.candidates.forEach(candidate => usedCandidates.add(candidate.candidateId));
  }
  if (manifest.candidates.some(candidate => usedCandidates.has(candidate.candidateId))) issues.push('Catalogue candidate identity is already owned by an earlier group.');
  const last = ordered[ordered.length - 1];
  if (group.groupNumber > 1 && (!last || group.previousGroup?.manifestId !== last.manifest.manifestId || group.previousGroup?.manifestHash !== last.manifestHash)) {
    issues.push('Catalogue predecessor ID and hash must match the verified app receipt.');
  }
  return [...new Set(issues)];
}

/** The transaction lock serializes all catalogue claims for one owner/source. */
export async function guardCatalogueGroupClaim(trx: any, userId: string, manifest: ContentManifest) {
  if (manifest.formatVersion !== CATALOGUE_CONTENT_MANIFEST_VERSION) return;
  await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`catalogue-delivery:${userId}:${manifest.source.contentHash}`]);
  const rows = await trx('content_pack_manifests').where({owner_user_id: userId, source_type: 'catalogue'})
    .select('payload', 'manifest_hash', 'status', 'last_verified_at', 'verification_report');
  const claimed: ClaimedCatalogueGroup[] = rows.map((row: any) => ({
    manifest: readJson(row.payload, {}), manifestHash: row.manifest_hash, status: row.status,
    verifiedAt: row.last_verified_at, verification: readJson(row.verification_report, {}),
  }));
  const issues = catalogueGroupClaimIssues(manifest, userId, claimed);
  if (issues.length) {
    // A missing/unverified predecessor is normal when production runs offline.
    // Never downgrade ownership, hash, preparation or identity failures.
    if (resolvedDelivery(manifest)) {
      const waiting = issues.every(issue => issue === 'Resolved delivery dependency is pending.');
      throw Object.assign(new Error(issues.join(' ')), {status: 409, ...(waiting ? {code: 'CATALOGUE_PREDECESSOR_PENDING'} : {})});
    }
    const group = catalogueDeliveryGroup(manifest)!;
    const prior = claimed.filter(item => item.manifest.source.contentHash === manifest.source.contentHash);
    const immediate = prior.find(item => catalogueDeliveryGroup(item.manifest)?.groupNumber === group.groupNumber - 1);
    const waiting = issues.every(issue => [
      'Claim only the first missing catalogue delivery group.',
      'Every earlier catalogue group requires a complete PostgreSQL read-back receipt.',
      'Catalogue predecessor ID and hash must match the verified app receipt.',
    ].includes(issue)) && prior.every(item =>
      (catalogueDeliveryGroup(item.manifest)?.groupNumber || 0) < group.groupNumber) &&
      (!immediate || !issues.includes('Catalogue predecessor ID and hash must match the verified app receipt.'));
    throw Object.assign(new Error(issues.join(' ')), {status: 409, ...(waiting ? {code: 'CATALOGUE_PREDECESSOR_PENDING'} : {})});
  }
}

function resolvedDelivery(manifest: ContentManifest) {
  return manifest.formatVersion === CATALOGUE_CONTENT_MANIFEST_VERSION ? manifest.catalogueAudit.resolvedDelivery : undefined;
}

/** All dependencies come from app-owned rows under the owner/source advisory lock. */
export function resolvedDeliveryClaimIssues(manifest: ContentManifest, ownerUserId: string, claimed: ClaimedCatalogueGroup[]): string[] {
  const delivery = resolvedDelivery(manifest)!;
  const issues: string[] = [];
  if (delivery.parent.ownerUserId !== ownerUserId) issues.push('Resolved delivery belongs to another account.');
  const prior = claimed.filter(item => item.manifest.source.contentHash === manifest.source.contentHash);
  const bases = prior.filter(item => resolvedDelivery(item.manifest)?.kind === 'base');
  for (const item of prior) {
    const old = resolvedDelivery(item.manifest);
    if (!old || old.parent.ownerUserId !== ownerUserId || old.parent.preparationHash !== delivery.parent.preparationHash) issues.push('Resolved delivery history has an incompatible owner, preparation or contract.');
    if (item.manifestHash !== contentPackHash(item.manifest)) issues.push('Stored catalogue manifest hash does not match its immutable payload.');
    const used = new Set(item.manifest.candidates.map(c => c.candidateId));
    const normalize = (s: string) => s.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
    const senses = new Set(item.manifest.candidates.filter(c => ["generate", "existing"].includes(c.decision)).map((c: any) => `${normalize(c.term)}|${normalize(c.senseKey)}`));
    if (manifest.candidates.some((c: any) => used.has(c.candidateId) || ["generate", "existing"].includes(c.decision) && senses.has(`${normalize(c.term)}|${normalize(c.senseKey)}`))) issues.push('Resolved delivery overlaps a previously claimed candidate or sense.');
  }
  const complete = (item: ClaimedCatalogueGroup) => item.status === 'completed' && Boolean(item.verifiedAt) && item.verification.verified === true &&
    item.verification.entries === item.manifest.candidates.filter(c => c.decision === 'generate').length && Array.isArray(item.verification.issues) && item.verification.issues.length === 0;
  const dependency = (ref: {manifestId: string; manifestHash: string} | null) => {
    if (!ref) return undefined;
    const row = prior.find(item => item.manifest.manifestId === ref.manifestId);
    if (!row) issues.push('Resolved delivery dependency is pending.');
    else if (row.manifestHash !== ref.manifestHash) issues.push('Resolved delivery dependency hash mismatch.');
    else if (!complete(row)) issues.push('Resolved delivery dependency is pending.');
    return row;
  };
  if (delivery.kind === 'base') {
    const cycles = bases.map(item => resolvedDelivery(item.manifest)!.cycleNumber).sort((a,b) => a-b);
    if (cycles.some((n,i) => n !== i+1) || cycles.some(n => n >= delivery.cycleNumber)) issues.push('Resolved base history has a gap, duplicate or repeated cycle.');
    if (bases.length < delivery.cycleNumber - 1 || bases.some(item => !complete(item))) issues.push('Resolved delivery dependency is pending.');
    const previous = dependency(delivery.previousBase);
    if (previous && (resolvedDelivery(previous.manifest)?.kind !== 'base' || resolvedDelivery(previous.manifest)?.cycleNumber !== delivery.cycleNumber - 1)) issues.push('Resolved base predecessor is not the preceding base cycle.');
  } else {
    const base = dependency(delivery.baseManifest);
    const previous = dependency(delivery.previousSupplement);
    const related = prior.filter(item => resolvedDelivery(item.manifest)?.kind === 'supplement' && resolvedDelivery(item.manifest)?.baseManifest?.manifestId === delivery.baseManifest?.manifestId);
    if (related.length && !previous || previous && !related.includes(previous)) issues.push('Supplement must follow its latest supplemental receipt.');
    const latest = related.reduce<ClaimedCatalogueGroup | undefined>((best,item) => !best || resolvedDelivery(item.manifest)!.parent.revision > resolvedDelivery(best.manifest)!.parent.revision ? item : best, undefined);
    if (latest && latest !== previous) issues.push('Supplement must follow its latest supplemental receipt.');
    if (base) {
      const bd = resolvedDelivery(base.manifest);
      const pd = resolvedDelivery((previous || base).manifest);
      if (!bd || !pd || bd.kind !== 'base' || bd.cycleNumber !== delivery.cycleNumber || JSON.stringify(bd.previousBase) !== JSON.stringify(delivery.previousBase)) issues.push('Supplement base binding mismatch.');
      else {
        const old = pd.parent; const current = delivery.parent;
        if (current.revision <= old.revision || parentLedgerHash(current.records) !== parentLedgerHash(old.records)) issues.push('Supplement must advance the same immutable record accounting.');
        const oldCandidates = new Map(old.candidates.map(c => [c.candidateId,c]));
        if (oldCandidates.size !== current.candidates.length || current.candidates.some(c => !oldCandidates.has(c.candidateId))) issues.push('Supplement cannot invent or omit parent candidates.');
        for (const c of current.candidates) {
          const earlier = oldCandidates.get(c.candidateId);
          if (!earlier) continue;
          if (earlier.disposition !== 'deferred' && parentLedgerHash(earlier) !== parentLedgerHash(c)) issues.push('Supplement changed an accepted decision.');
          if (parentLedgerHash(earlier.recordIds) !== parentLedgerHash(c.recordIds)) issues.push('Supplement changed candidate source identities.');
          if (earlier.disposition === 'deferred' && c.disposition !== 'deferred' && !delivery.candidateIds.includes(c.candidateId)) issues.push('Resolved supplemental candidate must be delivered explicitly.');
        }
        for (const id of delivery.candidateIds) if (oldCandidates.get(id)?.disposition !== 'deferred') issues.push('Supplement can deliver only previously deferred candidates.');
        if (current.recallUnits.length !== old.recallUnits.length || old.recallUnits.some(u => {
          const next = current.recallUnits.find(v => v.unitId === u.unitId);
          return !next || next.recordId !== u.recordId || u.disposition === 'resolved' && parentLedgerHash(u) !== parentLedgerHash(next);
        })) issues.push('Supplement changed accepted recall coverage.');
      }
    }
  }
  return [...new Set(issues)];
}
