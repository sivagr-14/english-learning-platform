import { cataloguePackFixture } from './catalogue-pack.fixture';
import { catalogueHash } from './catalogue-contract';
import { contentPackHash } from './content-pack-contract';

/** Synthetic 1,200-record source: two repeated entries and 1,198 empty records. */
export function catalogueDeliveryFixture(ownerUserId = '11111111-1111-4111-8111-111111111111', groupNumber = 1) {
  const {manifest, batch} = JSON.parse(JSON.stringify(cataloguePackFixture()));
  const prep = manifest.catalogueAudit.preparation;
  const original = prep.records[0];
  prep.records = Array.from({length: 1200}, (_, index) => {
    const wordId = index + 1;
    const source = {...original.source, wordId, ...(wordId === 1 || wordId === 1001 ? {} : {text: null, primaryMeaning: null})};
    return {...original, recordId: `wordup-${prep.source.sha256.slice(0, 16)}-${wordId}`, source,
      recordHash: catalogueHash(source), flags: []};
  });
  prep.assessmentGroups = Array.from({length: 12}, (_, index) => ({groupId: `group-${String(index + 1).padStart(5, '0')}`,
    recordIds: prep.records.slice(index * 100, (index + 1) * 100).map((record: any) => record.recordId)}));
  prep.source.recordCount = 1200;
  prep.audit = {records: 1200, groupedRecords: 1200, untracked: 0, words: 1200, expressions: 0, unknownTypes: 0, flagCounts: {}};
  delete prep.preparationHash; prep.preparationHash = catalogueHash(prep);
  const groups = prep.assessmentGroups.slice((groupNumber - 1) * 10, groupNumber * 10);
  const recordIds = groups.flatMap((group: any) => group.recordIds);
  const firstRecordId = recordIds[0];
  manifest.manifestId = `catalogue-delivery-fixture-${groupNumber}`;
  manifest.source.totalPages = manifest.source.totalChunks = groups.length;
  manifest.catalogueAudit.examplePolicy = 'catalogue-usage-types-v1';
  manifest.catalogueAudit.deliveryGroup = {policyId: 'wordup-delivery-groups-v1', ownerUserId, groupNumber,
    assessmentGroupIds: groups.map((group: any) => group.groupId),
    previousGroup: groupNumber === 1 ? null : {manifestId: 'catalogue-delivery-fixture-1', manifestHash: 'b'.repeat(64)}};
  manifest.candidates.forEach((candidate: any, index: number) => {
    candidate.candidateId = `delivery-${groupNumber}-meaning-${index + 1}`;
    candidate.catalogueEvidence.recordIds = [firstRecordId];
    candidate.catalogueEvidence.supportedUsageTypes = ['abstract'];
    candidate.catalogueEvidence.usageTypeReason = 'Synthetic labels test contract shape only; they do not certify semantic suitability.';
    candidate.occurrences[0].chunkId = groups[0].groupId;
  });
  const candidateIds = manifest.candidates.map((candidate: any) => candidate.candidateId);
  manifest.catalogueAudit.recordReviews = recordIds.map((recordId: string) => recordId === firstRecordId
    ? {recordId, status: 'assessed', candidateIds, additionalMeaningsReviewed: true, reason: 'Synthetic repeated charge entry with three fixture meanings.'}
    : {recordId, status: 'rejected', rejectionCode: 'malformed_record', candidateIds: [], additionalMeaningsReviewed: false, reason: 'Synthetic empty record is explicitly rejected and remains in the immutable preparation.'});
  manifest.coverage = {pages: groups.map((group: any, i: number) => ({page: i + 1, status: 'assessed', chunkIds: [group.groupId]})),
    chunks: groups.map((group: any, i: number) => ({chunkId: group.groupId, pageStart: i + 1, pageEnd: i + 1, status: 'assessed', candidateIds: i === 0 ? candidateIds : []}))};
  manifest.generationPlan.batches[0].candidateIds = candidateIds;
  batch.manifestId = manifest.manifestId; batch.batchId = `${manifest.manifestId}-batch-001`;
  batch.entries.forEach((entry: any, index: number) => {
    entry.candidateId = candidateIds[index];
    entry.lesson.natural_examples.examples = {abstract: entry.lesson.meaning_in_context.source_sentence};
  });
  batch.manifestHash = contentPackHash(manifest);
  return {manifest, batch};
}
