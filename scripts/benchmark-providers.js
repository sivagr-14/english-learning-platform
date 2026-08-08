#!/usr/bin/env node

const fs = require('fs');

function ratio(hit, total) {
  return total === 0 ? 1 : hit / total;
}

function scoreCase(gold, actual) {
  const expected = new Map(gold.candidates.map((item) => [`${item.term}|${item.senseKey}`, item]));
  const returned = new Map(actual.candidates.map((item) => [`${item.term}|${item.senseKey}`, item]));
  const matched = [...expected.keys()].filter((key) => returned.has(key));
  const phraseExpected = [...expected.values()].filter((item) => item.itemType !== 'word');
  const phraseMatched = phraseExpected.filter((item) => returned.has(`${item.term}|${item.senseKey}`));
  const taxonomyCorrect = matched.filter((key) => {
    const left = expected.get(key).taxonomy;
    const right = returned.get(key).taxonomy;
    return JSON.stringify(left) === JSON.stringify(right);
  }).length;
  const schemaValid = actual.candidates.filter((item) => item.schemaValid).length;
  return {
    precision: ratio(matched.length, returned.size),
    recall: ratio(matched.length, expected.size),
    phraseRecall: ratio(phraseMatched.length, phraseExpected.length),
    taxonomyAccuracy: ratio(taxonomyCorrect, matched.length),
    schemaCompliance: ratio(schemaValid, actual.candidates.length),
    tamilSemanticScore: Number(actual.tamilSemanticScore || 0),
    tamilNaturalnessScore: Number(actual.tamilNaturalnessScore || 0),
    completionSeconds: Number(actual.completionSeconds || 0),
    userEffortMinutes: Number(actual.userEffortMinutes || 0),
    costUsd: Number(actual.costUsd || 0),
  };
}

function benchmark(document) {
  return {
    schemaVersion: 'provider-benchmark-v1',
    generatedAt: new Date().toISOString(),
    thresholds: document.thresholds,
    cases: document.cases.map((entry) => ({
      id: entry.id,
      chatgpt: scoreCase(entry.gold, entry.chatgpt),
      gemini: scoreCase(entry.gold, entry.gemini),
    })),
  };
}

if (require.main === module) {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) {
    console.error('Usage: node scripts/benchmark-providers.js <results.json> <report.json>');
    process.exit(2);
  }
  fs.writeFileSync(output, `${JSON.stringify(benchmark(JSON.parse(fs.readFileSync(input, 'utf8'))), null, 2)}\n`);
}

module.exports = { benchmark, scoreCase };
