import { catalogueResolvedFixture, catalogueSupplementFixture } from './catalogue-resolved.fixture';
import { validateContentManifest, validateContentBatch, contentPackHash } from './content-pack-contract';
import { catalogueGroupClaimIssues, ClaimedCatalogueGroup } from './catalogue-delivery.service';
import { parentLedgerHash } from './catalogue-subset-accounting';
const receipt = (manifest: any): ClaimedCatalogueGroup => ({manifest,manifestHash:contentPackHash(manifest),status:'completed',verifiedAt:'2026-11-13',verification:{verified:true,entries:manifest.counts.generate,issues:[]}});
describe('resolved production delivery',()=>{
 test('validates ready meanings while retaining a deferred meaning',()=>{
  const p=catalogueResolvedFixture();expect(validateContentManifest(p.manifest).issues).toEqual([]);expect(validateContentBatch(p.batch,p.manifest).issues).toEqual([]);
 });
 test('allows a later base and late supplement without resetting base ordering',()=>{
  const first=catalogueResolvedFixture();const second=catalogueResolvedFixture(undefined,2);const supplement=catalogueSupplementFixture(first);
  second.manifest.catalogueAudit.resolvedDelivery.previousBase={manifestId:first.manifest.manifestId,manifestHash:contentPackHash(first.manifest)};
  expect(validateContentManifest(second.manifest).issues).toEqual([]);expect(validateContentManifest(supplement.manifest).issues).toEqual([]);expect(validateContentBatch(supplement.batch,supplement.manifest).issues).toEqual([]);
  const owner=first.manifest.catalogueAudit.deliveryGroup.ownerUserId;
  expect(catalogueGroupClaimIssues(first.manifest,owner,[])).toEqual([]);
  expect(catalogueGroupClaimIssues(second.manifest,owner,[receipt(first.manifest)])).toEqual([]);
  expect(catalogueGroupClaimIssues(supplement.manifest,owner,[receipt(first.manifest),receipt(second.manifest)])).toEqual([]);
 });
 test('rejects malformed or unbound selected evidence',()=>{
  const p=catalogueResolvedFixture();p.manifest.candidates[0].contextualMeaning+=' changed';expect(validateContentManifest(p.manifest).valid).toBe(false);
 });
 test.each(['owner','missing','hash','unverified','overlap','accepted-change','invented','recall-change'])('rejects %s',kind=>{
  const first=catalogueResolvedFixture();const supplement=catalogueSupplementFixture(first);const d=supplement.manifest.catalogueAudit.resolvedDelivery;
  let owner=d.parent.ownerUserId;let prior=[receipt(first.manifest)];
  if(kind==='owner')owner='22222222-2222-4222-8222-222222222222';
  if(kind==='missing')prior=[];
  if(kind==='hash')d.baseManifest.manifestHash='f'.repeat(64);
  if(kind==='unverified')prior[0].verification.verified=false;
  if(kind==='overlap')supplement.manifest.candidates=[first.manifest.candidates[0]];
  if(kind==='accepted-change')d.parent.candidates[0].evidenceHash='f'.repeat(64);
  if(kind==='invented')d.parent.candidates.push({...d.parent.candidates[0],candidateId:'invented'});
  if(kind==='recall-change')d.parent.recallUnits[0].evidenceHash='f'.repeat(64);
  expect(catalogueGroupClaimIssues(supplement.manifest,owner,prior).length).toBeGreaterThan(0);
 });
 test('requires exact full parent coverage even for a small delivered subset',()=>{
  const p=catalogueResolvedFixture();const d=p.manifest.catalogueAudit.resolvedDelivery;d.parent.records.pop();d.selection.parentHash=parentLedgerHash(d.parent);expect(validateContentManifest(p.manifest).valid).toBe(false);
 });
 test('never permits unknown fields or deferred candidates in a batch',()=>{
  const p=catalogueResolvedFixture();p.manifest.catalogueAudit.resolvedDelivery.ignoreQuality=true;expect(validateContentManifest(p.manifest).valid).toBe(false);
 });
});
