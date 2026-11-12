import { ContentManifest, contentPackHash, CATALOGUE_CONTENT_MANIFEST_VERSION } from './content-pack-contract';
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
    positions.set(key, [...(positions.get(key) || []), {index, row, number: group.groupNumber}]);
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
