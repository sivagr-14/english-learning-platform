const assert = require('node:assert/strict');
const test = require('node:test');
const { scoreCase } = require('./benchmark-providers');

test('provider benchmark scores contextual senses instead of spelling alone', () => {
  const gold = { candidates: [
    { term: 'bank', senseKey: 'money', itemType: 'word', taxonomy: ['daily', 'money', 'banking'] },
    { term: 'bank', senseKey: 'river', itemType: 'word', taxonomy: ['nature', 'water', 'rivers'] },
    { term: 'carry out', senseKey: 'perform', itemType: 'phrasal verb', taxonomy: ['work', 'tasks', 'execution'] },
  ] };
  const actual = { candidates: [
    { term: 'bank', senseKey: 'money', taxonomy: ['daily', 'money', 'banking'], schemaValid: true },
    { term: 'carry out', senseKey: 'perform', taxonomy: ['work', 'tasks', 'execution'], schemaValid: true },
  ], tamilSemanticScore: 4, tamilNaturalnessScore: 3 };
  const score = scoreCase(gold, actual);
  assert.equal(score.precision, 1);
  assert.equal(score.recall, 2 / 3);
  assert.equal(score.phraseRecall, 1);
  assert.equal(score.schemaCompliance, 1);
});
