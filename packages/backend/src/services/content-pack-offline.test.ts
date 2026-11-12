import { ContentPackService } from './content-pack.service';
import { catalogueDeliveryFixture } from './catalogue-delivery.fixture';
import { guardCatalogueGroupClaim } from './catalogue-delivery.service';
import { contentPackHash, validateContentManifest } from './content-pack-contract';

describe('offline catalogue queue', () => {
  function serviceWith(batches: any[]) {
    const {manifest, batch} = catalogueDeliveryFixture();
    const query: any = {where: () => query, first: async () => ({id: manifest.manifestId,
      payload: manifest, assessment_run_id: 'run', approved_at: new Date()}), orderBy: async () => batches};
    const service: any = new ContentPackService((() => query) as any);
    service.commitBatch = jest.fn().mockResolvedValue(0);
    service.verifyCommittedBatch = jest.fn().mockResolvedValue(undefined);
    service.reconcileManifest = jest.fn().mockResolvedValue(undefined);
    return {service, manifest, batch};
  }
  it('leaves a later batch queued when batch one is absent', async () => {
    const {service, manifest} = serviceWith([{batch_number: 2, status: 'staged'}]);
    await service.commitAvailableBatches('owner', manifest.manifestId);
    expect(service.commitBatch).not.toHaveBeenCalled();
  });
  it('recovers post-commit read-back without reimporting a committed batch', async () => {
    const {service, manifest} = serviceWith([{id: 'batch-one', batch_number: 1,
      status: 'committed', committed_word_ids: '["word-one"]'}]);
    await service.commitAvailableBatches('owner', manifest.manifestId);
    expect(service.verifyCommittedBatch).toHaveBeenCalledWith('owner', 'batch-one', ['word-one']);
    expect(service.commitBatch).not.toHaveBeenCalled();
  });
  it('does not continue past a failed read-back', async () => {
    const {service, manifest} = serviceWith([{id: 'batch-one', batch_number: 1,
      status: 'committed', committed_word_ids: '[]'}]);
    service.verifyCommittedBatch.mockRejectedValue(new Error('read-back failed'));
    await expect(service.commitAvailableBatches('owner', manifest.manifestId)).rejects.toThrow('read-back failed');
    expect(service.reconcileManifest).not.toHaveBeenCalled();
  });
  it('validates later production offline while local claiming waits for a predecessor', async () => {
    const {manifest} = catalogueDeliveryFixture(undefined, 2);
    expect(validateContentManifest(manifest).issues).toEqual([]);
    const trx: any = () => ({where: () => ({select: async () => []})});
    trx.raw = jest.fn();
    await expect(guardCatalogueGroupClaim(trx, manifest.catalogueAudit.deliveryGroup.ownerUserId, manifest))
      .rejects.toMatchObject({code: 'CATALOGUE_PREDECESSOR_PENDING'});
    await expect(guardCatalogueGroupClaim(trx, 'wrong-owner', manifest))
      .rejects.not.toMatchObject({code: 'CATALOGUE_PREDECESSOR_PENDING'});
  });
  it('keeps a predecessor hash mismatch as an integrity error', async () => {
    const first = catalogueDeliveryFixture();
    const {manifest} = catalogueDeliveryFixture(undefined, 2);
    manifest.catalogueAudit.deliveryGroup.previousGroup.manifestHash = 'a'.repeat(64);
    const trx: any = () => ({where: () => ({select: async () => [{payload: first.manifest,
      manifest_hash: contentPackHash(first.manifest), status: 'completed', last_verified_at: new Date(),
      verification_report: {verified: true, entries: 3, issues: []}}]})});
    trx.raw = jest.fn();
    await expect(guardCatalogueGroupClaim(trx, manifest.catalogueAudit.deliveryGroup.ownerUserId, manifest))
      .rejects.not.toMatchObject({code: 'CATALOGUE_PREDECESSOR_PENDING'});
  });
});
