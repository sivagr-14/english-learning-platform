import { catalogueDeliveryFixture } from './catalogue-delivery.fixture';
import { contentPackHash } from './content-pack-contract';
import { parentLedgerHash } from './catalogue-subset-accounting';

/** Synthetic contract data only; never catalogue production evidence. */
export function catalogueResolvedFixture(owner?: string, cycleNumber = 1) {
  const pack = catalogueDeliveryFixture(owner);
  const m = pack.manifest;
  const groups = m.catalogueAudit.preparation.assessmentGroups.slice((cycleNumber - 1) * 5, cycleNumber * 5);
  const ids = groups.flatMap((g: any) => g.recordIds);
  const records = m.catalogueAudit.preparation.records.filter((r: any) => ids.includes(r.recordId));
  const all = cycleNumber === 1 ? [...m.candidates] : [];
  const parent: any = {
    version: 'wordup-parent-ledger-v1', ownerUserId: m.catalogueAudit.deliveryGroup.ownerUserId,
    sourceHash: m.source.contentHash, preparationHash: m.catalogueAudit.preparation.preparationHash,
    groupNumber: Math.ceil(cycleNumber / 2), revision: 1,
    records: records.map((r: any,i: number) => ({recordId:r.recordId, recordHash:r.recordHash,
      candidateIds: i === 0 ? all.map((c:any)=>c.candidateId) : [], recallUnitIds:[`word-${r.recordId}`,`expression-${r.recordId}`],
      ...(!all.length || i !== 0 ? {rejection:{code:'malformed_record',reason:'Synthetic empty source record rejected explicitly.'}} : {}),
    })),
    candidates: all.map((c:any,i:number) => ({candidateId:c.candidateId,term:c.term,senseKey:c.senseKey,contextualMeaning:c.contextualMeaning,meaningOrigin:c.catalogueEvidence.meaningOrigin,recordIds:c.catalogueEvidence.recordIds,
      senseIdentity:`${c.term}|${c.senseKey}`,evidenceHash:parentLedgerHash(c),disposition:i===2?'deferred':'resolved',
      ...(i===2 ? {review:{reviewId:'deferred-third',reason:'ambiguity',missingFields:['meaning'],dependency:'source context',nextAction:'Review the source evidence for the remaining meaning.',
        attempts:[{kind:'substantive',at:'2026-11-13T10:00:00Z',evidenceHash:parentLedgerHash(c),outcome:'Synthetic first review is inconclusive.'},{kind:'targeted_retry',at:'2026-11-13T10:05:00Z',evidenceHash:parentLedgerHash(c),outcome:'Synthetic targeted retry is inconclusive.'}]}}:{}),
    })),
    recallUnits:records.flatMap((r:any)=>['single_word','expression'].map(kind=>({unitId:`${kind==='single_word'?'word':'expression'}-${r.recordId}`,recordId:r.recordId,kind,disposition:'resolved',evidenceHash:r.recordHash}))),
  };
  m.manifestId=`resolved-cycle-${cycleNumber}`;
  m.catalogueAudit.deliveryGroup={...m.catalogueAudit.deliveryGroup,groupNumber:parent.groupNumber,assessmentGroupIds:groups.map((g:any)=>g.groupId),previousGroup:null};
  m.catalogueAudit.resolvedDelivery={policyId:'wordup-resolved-delivery-v1',kind:'base',cycleNumber,
    previousBase:cycleNumber===1?null:{manifestId:'resolved-cycle-1',manifestHash:'b'.repeat(64)},baseManifest:null,previousSupplement:null,parent,
    selection:{version:'wordup-resolved-selection-v1',parentHash:parentLedgerHash(parent),included:all.slice(0,2).map((c:any)=>c.candidateId),excluded:[],deferred:all.slice(2).map((c:any)=>c.candidateId)},candidateIds:all.slice(0,2).map((c:any)=>c.candidateId)};
  m.candidates=all.slice(0,2);
  m.catalogueAudit.recordReviews=m.catalogueAudit.recordReviews.filter((r:any)=>ids.includes(r.recordId)).map((r:any)=>({...r,candidateIds:r.candidateIds.filter((id:string)=>m.candidates.some((c:any)=>c.candidateId===id))}));
  m.source.totalPages=m.source.totalChunks=groups.length;
  m.coverage={pages:groups.map((g:any,i:number)=>({page:i+1,status:'assessed',chunkIds:[g.groupId]})),chunks:groups.map((g:any,i:number)=>({chunkId:g.groupId,pageStart:i+1,pageEnd:i+1,status:'assessed',candidateIds:i===0?m.candidates.map((c:any)=>c.candidateId):[]}))};
  m.counts={totalCandidates:m.candidates.length,generate:m.candidates.length,existing:0,filtered:0,rejected:0,heavyUse:0,mediumUse:m.candidates.length};
  m.generationPlan.batches=m.candidates.length?[{batchNumber:1,candidateIds:m.candidates.map((c:any)=>c.candidateId)}]:[];
  pack.batch.manifestId=m.manifestId;pack.batch.batchId=`${m.manifestId}-001`;pack.batch.entries=pack.batch.entries.slice(0,2);pack.batch.manifestHash=contentPackHash(m);
  return {...pack,deferred:all[2]};
}

export function catalogueSupplementFixture(base: ReturnType<typeof catalogueResolvedFixture>) {
  const pack=JSON.parse(JSON.stringify(base));const m=pack.manifest;const d=m.catalogueAudit.resolvedDelivery;
  m.manifestId+='-supplement';d.kind='supplement';d.baseManifest={manifestId:base.manifest.manifestId,manifestHash:contentPackHash(base.manifest)};
  d.parent.revision++;
  const candidate=base.deferred;d.parent.candidates.find((c:any)=>c.candidateId===candidate.candidateId).disposition='resolved';
  d.selection.included.push(candidate.candidateId);d.selection.deferred=[];d.selection.parentHash=parentLedgerHash(d.parent);d.candidateIds=[candidate.candidateId];
  m.candidates=[candidate];m.catalogueAudit.recordReviews.forEach((r:any)=>{r.candidateIds=r.recordId===candidate.catalogueEvidence.recordIds[0]?[candidate.candidateId]:[];});
  m.coverage.chunks.forEach((c:any,i:number)=>{c.candidateIds=i===0?[candidate.candidateId]:[];});
  m.counts.totalCandidates=m.counts.generate=m.counts.mediumUse=1;m.generationPlan.batches=[{batchNumber:1,candidateIds:[candidate.candidateId]}];
  const original=catalogueDeliveryFixture(d.parent.ownerUserId);
  pack.batch.entries=[original.batch.entries[2]];pack.batch.manifestId=m.manifestId;pack.batch.batchId=`${m.manifestId}-001`;pack.batch.manifestHash=contentPackHash(m);
  return pack;
}
