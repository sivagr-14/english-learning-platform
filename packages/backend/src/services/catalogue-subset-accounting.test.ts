import { strict as assert } from 'assert';
import type { ParentLedger, SubsetSelection } from './catalogue-subset-accounting';
import { parentLedgerHash, subsetAccountingIssues } from './catalogue-subset-accounting';

function fixture() {
  const parent: ParentLedger = {
    version: 'wordup-parent-ledger-v1', ownerUserId: 'owner', sourceHash: 'a'.repeat(64), preparationHash: 'b'.repeat(64), groupNumber: 1, revision: 1,
    records: [{recordId: 'r1', recordHash: 'c'.repeat(64), candidateIds: ['ready', 'later', 'excluded'], recallUnitIds: ['recall1']}],
    candidates: [
      {candidateId: 'ready', recordIds: ['r1'], senseIdentity: 'term:first', disposition: 'resolved', evidenceHash: 'd'.repeat(64)},
      {candidateId: 'later', recordIds: ['r1'], senseIdentity: 'term:second', disposition: 'deferred', evidenceHash: 'e'.repeat(64), review: {
        reviewId: 'review-later', reason: 'ambiguity', missingFields: ['senseBoundary'], dependency: 'additional source evidence', nextAction: 'Reconcile source sense when new evidence becomes available.',
        attempts: [
          {kind: 'substantive', at: '2026-11-13T10:00:00Z', evidenceHash: 'e'.repeat(64), outcome: 'Two readings remain supported.'},
          {kind: 'targeted_retry', at: '2026-11-13T10:05:00Z', evidenceHash: 'e'.repeat(64), outcome: 'Targeted context review cannot distinguish the readings.'},
        ],
      }},
      {candidateId: 'excluded', recordIds: ['r1'], senseIdentity: 'term:third', disposition: 'excluded', evidenceHash: 'f'.repeat(64)},
    ],
    recallUnits: [{unitId: 'recall1', recordId: 'r1', disposition: 'resolved', evidenceHash: '1'.repeat(64)}],
  };
  const selection: SubsetSelection = {version: 'wordup-resolved-selection-v1', parentHash: parentLedgerHash(parent), included: ['ready'], excluded: ['excluded'], deferred: ['later']};
  const expected = {ownerUserId: parent.ownerUserId, sourceHash: parent.sourceHash, preparationHash: parent.preparationHash, groupNumber: 1, records: parent.records.map(r => ({recordId: r.recordId, recordHash: r.recordHash}))};
  return {parent, selection, expected};
}

describe('draft resolved-subset parent accounting (not import capability)', () => {
  test('retains deferred and excluded membership without modifying inputs', () => {
    const f = fixture(); const before = JSON.stringify(f);
    assert.deepEqual(subsetAccountingIssues(f.parent, f.selection, f.expected), []);
    assert.equal(JSON.stringify(f), before);
  });
  test('canonical hash ignores object insertion order but preserves array order', () => {
    assert.equal(parentLedgerHash({b: 2, a: 1}), parentLedgerHash({a: 1, b: 2}));
    assert.notEqual(parentLedgerHash(['a', 'b']), parentLedgerHash(['b', 'a']));
  });
  const mutations: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
    ['omitted deferred candidate', f => { f.selection.deferred = []; }],
    ['overlapping membership', f => { f.selection.included.push('later'); }],
    ['unknown included candidate', f => { f.selection.included.push('invented'); }],
    ['deferred promoted without resolution', f => { f.selection.included.push('later'); f.selection.deferred = []; }],
    ['excluded promoted to generation', f => { f.selection.included.push('excluded'); f.selection.excluded = []; }],
    ['duplicate candidate', f => { f.parent.candidates.push({...f.parent.candidates[0]}); }],
    ['duplicate semantic identity', f => { f.parent.candidates[1].senseIdentity = f.parent.candidates[0].senseIdentity; }],
    ['missing prepared record', f => { f.parent.records = []; }],
    ['unexpected extra record', f => { f.parent.records.push({...f.parent.records[0], recordId: 'r2'}); }],
    ['duplicate record', f => { f.parent.records.push({...f.parent.records[0]}); }],
    ['altered immutable record hash', f => { f.parent.records[0].recordHash = '2'.repeat(64); }],
    ['broken reverse candidate link', f => { f.parent.records[0].candidateIds = ['ready', 'later']; }],
    ['candidate assigned elsewhere', f => { f.parent.candidates[0].recordIds = ['other']; }],
    ['missing evidence hash', f => { f.parent.candidates[0].evidenceHash = ''; }],
    ['unresolved recall for included candidate', f => { f.parent.recallUnits[0].disposition = 'deferred'; }],
    ['missing recall', f => { f.parent.recallUnits = []; }],
    ['unbound recall', f => { f.parent.recallUnits[0].recordId = 'other'; }],
    ['wrong owner', f => { f.parent.ownerUserId = 'another'; }],
    ['wrong source', f => { f.parent.sourceHash = '3'.repeat(64); }],
    ['wrong preparation', f => { f.parent.preparationHash = '4'.repeat(64); }],
    ['wrong accounting group', f => { f.parent.groupNumber = 2; }],
    ['invalid revision', f => { f.parent.revision = 0; }],
    ['deferral without attempts', f => { delete f.parent.candidates[1].review; }],
    ['deferral after only one attempt', f => { f.parent.candidates[1].review!.attempts.pop(); }],
    ['deferral without next action', f => { f.parent.candidates[1].review!.nextAction = ''; }],
    ['deferral with invalid timestamp', f => { f.parent.candidates[1].review!.attempts[0].at = 'yesterday'; }],
    ['retry predates first attempt', f => { f.parent.candidates[1].review!.attempts[1].at = '2026-11-12T00:00:00Z'; }],
    ['deferral without evidence hash', f => { f.parent.candidates[1].review!.attempts[1].evidenceHash = ''; }],
  ];
  for (const [name, mutate] of mutations) test(`rejects ${name} even after rehashing`, () => {
    const f = fixture(); mutate(f); f.selection.parentHash = parentLedgerHash(f.parent);
    assert.ok(subsetAccountingIssues(f.parent, f.selection, f.expected).length > 0);
  });
  test('rejects stale parent snapshot hash', () => {
    const f = fixture(); f.parent.revision++;
    assert.ok(subsetAccountingIssues(f.parent, f.selection, f.expected).includes('Parent ledger hash mismatch.'));
  });
});

