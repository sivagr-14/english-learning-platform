import { catalogueDeliveryFixture } from './catalogue-delivery.fixture';
import { catalogueHash } from './catalogue-contract';
import { catalogueGroupClaimIssues, guardCatalogueGroupClaim, ClaimedCatalogueGroup, orderCatalogueDeliveryRows } from './catalogue-delivery.service';
import { contentPackHash, validateContentManifest, validateContentBatch } from './content-pack-contract';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const owner = '11111111-1111-4111-8111-111111111111';
function history(manifest: any): ClaimedCatalogueGroup {
  return {manifest, manifestHash: contentPackHash(manifest), status: 'completed', verifiedAt: '2026-11-05T00:00:00Z', verification: {verified: true, entries: 3, issues: []}};
}
function consecutive() {
  const first = catalogueDeliveryFixture(owner);
  const next = catalogueDeliveryFixture(owner, 2);
  next.manifest.catalogueAudit.deliveryGroup.previousGroup.manifestHash = contentPackHash(first.manifest);
  return {first, next, prior: history(first.manifest)};
}

describe('immutable catalogue delivery groups', () => {
  it('runs the exact production validator on a complete group and rejects an omitted record', () => {
    const {manifest, batch} = catalogueDeliveryFixture();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogue-delivery-'));
    const run = () => spawnSync(process.execPath, [require.resolve('ts-node/dist/bin'), '--transpile-only', '--project',
      path.resolve(__dirname, '../../tsconfig.json'), path.resolve(__dirname, '../scripts/validate-content-packs.ts'), directory], {encoding: 'utf8'});
    try {
      fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(directory, 'batch.json'), JSON.stringify(batch));
      const valid = run(); expect(valid.stderr).toBe(''); expect(valid.status).toBe(0);
      manifest.catalogueAudit.recordReviews.pop();
      fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
      const invalid = run(); expect(invalid.status).toBe(1); expect(invalid.stderr).toContain('selected scope exactly once');
    } finally { fs.rmSync(directory, {recursive: true, force: true}); }
  });
  it('drains consecutive groups in order without moving unrelated sources', () => {
    const {first, next} = consecutive();
    const rows = [{id: 'next', payload: next.manifest}, {id: 'unrelated'}, {id: 'first', payload: JSON.stringify(first.manifest)}];
    expect(orderCatalogueDeliveryRows(rows).map(row => row.id)).toEqual(['first', 'unrelated', 'next']);
  });
  it('validates 1,000 records and the 200-record tail against the same full preparation', () => {
    const {first, next} = consecutive();
    expect(first.manifest.catalogueAudit.preparation).toEqual(next.manifest.catalogueAudit.preparation);
    expect(first.manifest.catalogueAudit.recordReviews).toHaveLength(1000);
    expect(next.manifest.catalogueAudit.recordReviews).toHaveLength(200);
    expect(validateContentManifest(first.manifest).issues).toEqual([]);
    expect(validateContentBatch(first.batch, first.manifest).issues).toEqual([]);
    expect(validateContentManifest(next.manifest).issues).toEqual([]);
  });
  it.each(['missing-review', 'outside-review', 'reordered-groups', 'wrong-group', 'changed-source', 'unknown-group', 'no-predecessor', 'no-example-policy', 'overwrite', 'ambiguous'])('rejects invalid group scope: %s', mutation => {
    const {manifest} = catalogueDeliveryFixture(owner, 2);
    const audit = manifest.catalogueAudit;
    if (mutation === 'missing-review') audit.recordReviews.pop();
    if (mutation === 'outside-review') audit.recordReviews[1].recordId = audit.preparation.records[0].recordId;
    if (mutation === 'reordered-groups') audit.deliveryGroup.assessmentGroupIds.reverse();
    if (mutation === 'wrong-group') audit.deliveryGroup.groupNumber = 1;
    if (mutation === 'changed-source') audit.preparation.records[0].source.text = 'tampered';
    if (mutation === 'unknown-group') audit.deliveryGroup.groupNumber = 3;
    if (mutation === 'no-predecessor') audit.deliveryGroup.previousGroup = null;
    if (mutation === 'no-example-policy') delete audit.examplePolicy;
    if (mutation === 'overwrite') manifest.candidates[0].operation = 'update';
    if (mutation === 'ambiguous') manifest.candidates[0].senseDecision = 'ambiguous';
    expect(validateContentManifest(manifest).valid).toBe(false);
  });
  function ambiguityExclusion() {
    const {manifest, batch} = JSON.parse(JSON.stringify(catalogueDeliveryFixture()));
    const candidate = manifest.candidates[0];
    candidate.decision = 'filtered';
    candidate.senseDecision = 'ambiguous';
    candidate.reason = 'ambiguous_context: bounded source reviews could not distinguish the two supplied interpretations.';
    delete candidate.operation;
    manifest.counts.generate--;
    manifest.counts.filtered++;
    manifest.generationPlan.batches[0].candidateIds.shift();
    batch.entries.shift();
    batch.manifestHash = contentPackHash(manifest);
    return {manifest, batch, candidate};
  }
  it('accounts for final ambiguity exclusions without generating or losing their source records', () => {
    const {manifest, batch, candidate} = ambiguityExclusion();
    expect(manifest.catalogueAudit.recordReviews[0].candidateIds).toContain(candidate.candidateId);
    expect(validateContentManifest(manifest).issues).toEqual([]);
    expect(validateContentBatch(batch, manifest).issues).toEqual([]);
    manifest.generationPlan.batches[0].candidateIds.unshift(candidate.candidateId);
    expect(validateContentManifest(manifest).valid).toBe(false);
  });
  it.each(['missing-reason', 'wrong-reason', 'empty-explanation', 'generated', 'existing', 'rejected', 'matched-word', 'missing-coverage'])('rejects unsafe ambiguity accounting: %s', mutation => {
    const {manifest, candidate} = ambiguityExclusion();
    if (mutation === 'missing-reason') delete candidate.reason;
    if (mutation === 'wrong-reason') candidate.reason = 'low_frequency: do not use this as an ambiguity workaround.';
    if (mutation === 'empty-explanation') candidate.reason = 'ambiguous_context:   ';
    if (mutation === 'generated') candidate.decision = 'generate';
    if (mutation === 'existing') candidate.decision = 'existing';
    if (mutation === 'rejected') candidate.decision = 'rejected';
    if (mutation === 'matched-word') candidate.matchedWordId = owner;
    if (mutation === 'missing-coverage') manifest.catalogueAudit.recordReviews.shift();
    expect(validateContentManifest(manifest).valid).toBe(false);
  });
  it('does not turn a partial legacy manifest into a valid manifest', () => {
    const {manifest} = catalogueDeliveryFixture(); delete manifest.catalogueAudit.deliveryGroup;
    expect(validateContentManifest(manifest).valid).toBe(false);
  });
  it('refuses repartitioned historical 100-record assessment groups', () => {
    const {manifest} = catalogueDeliveryFixture();
    const prep = manifest.catalogueAudit.preparation;
    prep.assessmentGroups[1].recordIds.unshift(prep.assessmentGroups[0].recordIds.pop());
    delete prep.preparationHash; prep.preparationHash = catalogueHash(prep);
    expect(validateContentManifest(manifest).valid).toBe(false);
  });
  it('claims the first missing group only after app-owned read-back of every predecessor', () => {
    const {first, next, prior} = consecutive();
    expect(catalogueGroupClaimIssues(first.manifest, owner, [])).toEqual([]);
    expect(catalogueGroupClaimIssues(next.manifest, owner, [prior])).toEqual([]);
    expect(catalogueGroupClaimIssues(next.manifest, owner, [])).not.toEqual([]);
    expect(catalogueGroupClaimIssues(first.manifest, owner, [prior])).not.toEqual([]);
  });
  it.each(['wrong-owner', 'unverified', 'unfinished', 'skipped', 'wrong-hash', 'duplicate', 'changed-preparation', 'reused-candidate', 'predecessor-mismatch'])('refuses unsafe app history: %s', mutation => {
    const {next, prior} = consecutive(); const rows = [prior]; let claimant = owner;
    if (mutation === 'wrong-owner') claimant = '22222222-2222-4222-8222-222222222222';
    if (mutation === 'unverified') prior.verifiedAt = null;
    if (mutation === 'unfinished') prior.status = 'processing';
    if (mutation === 'skipped') prior.verification.entries = 2;
    if (mutation === 'wrong-hash') prior.manifestHash = 'c'.repeat(64);
    if (mutation === 'duplicate') rows.push(prior);
    if (mutation === 'changed-preparation') next.manifest.catalogueAudit.preparation.preparationHash = 'd'.repeat(64);
    if (mutation === 'reused-candidate') next.manifest.candidates[0].candidateId = prior.manifest.candidates[0].candidateId;
    if (mutation === 'predecessor-mismatch') next.manifest.catalogueAudit.deliveryGroup.previousGroup.manifestId = 'another-manifest';
    expect(catalogueGroupClaimIssues(next.manifest, claimant, rows)).not.toEqual([]);
  });
  it('uses a transaction advisory lock before reading the owner-scoped ledger', async () => {
    const {first} = consecutive(); const events: string[] = [];
    const trx: any = (table: string) => {
      expect(table).toBe('content_pack_manifests');
      return {where: (filter: any) => { expect(filter).toEqual({owner_user_id: owner, source_type: 'catalogue'});
        return {select: async () => {events.push('read'); return [];}}; }};
    };
    trx.raw = async (sql: string, params: string[]) => {expect(sql).toContain('pg_advisory_xact_lock'); expect(params[0]).toContain(owner); events.push('lock');};
    await guardCatalogueGroupClaim(trx, owner, first.manifest);
    expect(events).toEqual(['lock', 'read']);
  });
});
