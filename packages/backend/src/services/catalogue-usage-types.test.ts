import { cataloguePackFixture } from './catalogue-pack.fixture';
import { contentPackHash, validateContentManifest, validateContentBatch, catalogueUsageTypesForCandidate } from './content-pack-contract';
import { assertVocabularyLessonCompliant } from '../data/vocabulary-lesson-template';
import { validateVocabularyImportEntry, VocabularyImportService } from './vocabulary-import.service';
import { ContentPackService } from './content-pack.service';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

function typedPack(types: string[] = ['abstract']) {
  const {manifest, batch} = JSON.parse(JSON.stringify(cataloguePackFixture()));
  manifest.catalogueAudit.examplePolicy = 'catalogue-usage-types-v1';
  for (const [index, candidate] of manifest.candidates.entries()) {
    candidate.catalogueEvidence.supportedUsageTypes = types;
    candidate.catalogueEvidence.usageTypeReason = 'Synthetic test declaration only; a real author must justify each type within one assessed sense.';
    const example = batch.entries[index].lesson.meaning_in_context.source_sentence;
    // Fixtures test structure, never semantic certification of the synthetic labels.
    batch.entries[index].lesson.natural_examples.examples = Object.fromEntries(types.map((type, n) => [type, `${example} Context number ${n + 1}.`]));
  }
  batch.manifestHash = contentPackHash(manifest);
  return {manifest, batch};
}

describe('catalogue usage-type policy', () => {
  it('runs the production validator and refuses a batch without its immutable manifest', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'catalogue-example-policy-'));
    const {manifest, batch} = typedPack();
    const script = path.resolve(__dirname, '../scripts/validate-content-packs.ts');
    const validate = () => spawnSync(process.execPath, [require.resolve('ts-node/dist/bin'),
      '--transpile-only', '--project', path.resolve(__dirname, '../../tsconfig.json'), script, directory], {encoding: 'utf8'});
    try {
      fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(directory, 'batch.json'), JSON.stringify(batch));
      const valid = validate();
      expect(valid.stderr).toBe('');
      expect(valid.status).toBe(0);
      expect(valid.stdout).toContain('Validated 1 manifest(s) and 1 batch(es).');
      fs.unlinkSync(path.join(directory, 'manifest.json'));
      const orphan = validate();
      expect(orphan.status).toBe(1);
      expect(orphan.stderr).toContain('a valid immutable manifest must accompany every batch');
    } finally { fs.rmSync(directory, {recursive: true, force: true}); }
  });
  it.each([['abstract'], ['literal', 'figurative'], ['literal', 'abstract', 'figurative']])('accepts exact supported type sets %j', (...types) => {
    const {manifest, batch} = typedPack(types);
    expect(validateContentManifest(manifest).issues).toEqual([]);
    expect(validateContentBatch(batch, manifest).issues).toEqual([]);
  });
  it.each(['missing-types', 'repeated-type', 'unknown-type', 'empty-types', 'missing-reason', 'policy-missing'])('rejects invalid manifest declaration: %s', mutation => {
    const {manifest} = typedPack();
    const evidence = manifest.candidates[0].catalogueEvidence;
    if (mutation === 'missing-types') delete evidence.supportedUsageTypes;
    if (mutation === 'repeated-type') evidence.supportedUsageTypes = ['literal', 'literal'];
    if (mutation === 'unknown-type') evidence.supportedUsageTypes = ['technical'];
    if (mutation === 'empty-types') evidence.supportedUsageTypes = [];
    if (mutation === 'missing-reason') delete evidence.usageTypeReason;
    if (mutation === 'policy-missing') delete manifest.catalogueAudit.examplePolicy;
    expect(validateContentManifest(manifest).valid).toBe(false);
  });
  it.each(['missing', 'extra', 'unlabelled', 'duplicate-sentence', 'unrelated', 'empty'])('rejects incorrect examples: %s', mutation => {
    const {manifest, batch} = typedPack(['literal', 'abstract']);
    const examples = batch.entries[0].lesson.natural_examples.examples;
    if (mutation === 'missing') delete examples.literal;
    if (mutation === 'extra') examples.figurative = 'The company will charge us for this service.';
    if (mutation === 'unlabelled') { examples.workplace = examples.literal; delete examples.literal; }
    if (mutation === 'duplicate-sentence') examples.abstract = examples.literal;
    if (mutation === 'unrelated') examples.abstract = 'The neighbours are leaving for work this morning.';
    if (mutation === 'empty') batch.entries[0].lesson.natural_examples.examples = {};
    expect(validateContentBatch(batch, manifest).valid).toBe(false);
  });
  it('retains the legacy catalogue contract', () => {
    const {manifest,batch} = cataloguePackFixture();
    expect(validateContentManifest(manifest).issues).toEqual([]);
    expect(validateContentBatch(batch,manifest).issues).toEqual([]);
  });
  it('does not trust authored provenance or a single labelled example alone', () => {
    const {batch} = typedPack();
    expect(() => assertVocabularyLessonCompliant(batch.entries[0].lesson,'charge')).toThrow();
  });
  it('preserves all eight sections and term-specific teaching requirements', () => {
    const {manifest,batch} = typedPack();
    batch.entries[0].lesson.advanced_nuance = [];
    expect(validateContentBatch(batch,manifest).valid).toBe(false);
  });
  it('passes the identical trusted usage types to actual import-entry validation', () => {
    const {manifest,batch} = typedPack();
    const entry = batch.entries[0];
    const row = {word:entry.word,category:'Practice and improvement',pronunciation:entry.pronunciation,word_type:entry.wordType,item_type:'word',cefr_level:'B2',frequency:'High',english_meaning:entry.englishMeaning,tamil_meaning:entry.tamilMeaning,core_idea:entry.coreIdea,lesson_data:entry.lesson};
    expect(() => validateVocabularyImportEntry(row)).toThrow();
    expect(() => validateVocabularyImportEntry(row, {trustedCatalogueUsageTypes:catalogueUsageTypesForCandidate(manifest,entry.candidateId)})).not.toThrow();
    expect(() => validateVocabularyImportEntry(row, {trustedCatalogueUsageTypes:['figurative']})).toThrow();
  });

  it.each([true, false])('passes only persisted manifest policy through batch commit (typed=%s)', async typed => {
    const {manifest, batch} = typed ? typedPack() : JSON.parse(JSON.stringify(cataloguePackFixture()));
    expect(validateContentManifest(manifest).valid).toBe(true);
    expect(validateContentBatch(batch, manifest).valid).toBe(true);
    const candidates = manifest.candidates.map((candidate: any) => ({
      id: candidate.candidateId, external_candidate_id: candidate.candidateId,
      status: 'approved', item_type: candidate.itemType, cefr_level: candidate.cefrLevel,
      usage_frequency: candidate.usageFrequency,
      proposed_categories: [{name: candidate.categoryName, relationship: 'primary'}],
      sense_evidence: candidate.senseEvidence,
    }));
    const receipts: any[] = [];
    const trx = (table: string) => {
      const query: any = {
        where: () => query, forUpdate: () => query,
        whereIn: async () => candidates,
        first: async () => table === 'content_pack_batches' ? {status: 'staged'} :
          table === 'generation_jobs' ? {id: 'fixture-job'} : undefined,
        update: async () => 1,
        insert: async (row: any) => { if (table === 'content_pack_entry_receipts') receipts.push(row); },
      };
      return query;
    };
    const service = new ContentPackService({transaction: (callback: any) => callback(trx)});
    // This tests the real commit-to-import validation handoff, not a PostgreSQL read-back.
    const readBack = jest.spyOn(service as any, 'verifyCommittedBatch').mockResolvedValue(undefined);
    const imports = jest.spyOn(VocabularyImportService.prototype, 'importSingle').mockImplementation(async (row, owner, options) => {
      expect(owner).toBe('fixture-owner');
      expect(options?.trustedCatalogueUsageTypes).toEqual(typed ? ['abstract'] : undefined);
      validateVocabularyImportEntry(row, options);
      return {imported: 1, errors: [], items: [{word: {id: `word-${receipts.length}`}}]} as any;
    });
    try {
      const count = await (service as any).commitBatch('fixture-owner',
        {id: manifest.manifestId, assessment_run_id: 'fixture-assessment', payload: JSON.stringify(manifest)},
        {id: batch.batchId}, batch);
      expect(count).toBe(batch.entries.length);
      expect(imports).toHaveBeenCalledTimes(batch.entries.length);
      expect(receipts).toHaveLength(batch.entries.length);
      expect(readBack).toHaveBeenCalledWith('fixture-owner', batch.batchId, receipts.map(receipt => receipt.word_id));
    } finally { imports.mockRestore(); readBack.mockRestore(); }
  });
});
