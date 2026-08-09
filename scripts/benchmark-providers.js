#!/usr/bin/env node
const fs = require('fs');
const METRICS = ['precision','recall','phraseRecall','contextualMeaningAccuracy','senseDecisionAccuracy','taxonomyAccuracy','eightSectionQuality','schemaCompliance','tamilSemanticScore','tamilNaturalnessScore'];
const ratio = (hit, total) => total === 0 ? 1 : hit / total;
const candidateKey = (item) => `${String(item.term).trim().toLowerCase()}|${String(item.senseKey).trim().toLowerCase()}`;

function scoreCase(gold, actual) {
  if (!actual || actual.status !== 'completed' || !Array.isArray(actual.candidates)) return { status: actual?.status || 'not_run', blockingReasons: [actual?.reason || 'Provider run was not completed.'] };
  const expected = new Map(gold.candidates.map((item) => [candidateKey(item), item]));
  const returned = new Map(actual.candidates.map((item) => [candidateKey(item), item]));
  const matched = [...expected.keys()].filter((key) => returned.has(key));
  const phraseExpected = [...expected.values()].filter((item) => item.itemType !== 'word');
  const exact = (field) => matched.filter((key) => expected.get(key)[field] === returned.get(key)[field]).length;
  const taxonomyCorrect = matched.filter((key) => JSON.stringify(expected.get(key).taxonomy) === JSON.stringify(returned.get(key).taxonomy)).length;
  return { status: 'completed', precision: ratio(matched.length, returned.size), recall: ratio(matched.length, expected.size),
    phraseRecall: ratio(phraseExpected.filter((item) => returned.has(candidateKey(item))).length, phraseExpected.length),
    contextualMeaningAccuracy: ratio(exact('contextualMeaning'), matched.length), senseDecisionAccuracy: ratio(exact('senseDecision'), matched.length),
    taxonomyAccuracy: ratio(taxonomyCorrect, matched.length), eightSectionQuality: ratio(actual.candidates.filter((item) => item.eightSectionValid === true).length, actual.candidates.length),
    schemaCompliance: ratio(actual.candidates.filter((item) => item.schemaValid === true).length, actual.candidates.length),
    tamilSemanticScore: Number(actual.tamilSemanticScore), tamilNaturalnessScore: Number(actual.tamilNaturalnessScore),
    completionSeconds: Number(actual.completionSeconds), userEffortMinutes: Number(actual.userEffortMinutes), costUsd: actual.costUsd == null ? null : Number(actual.costUsd) };
}

function aggregate(cases, provider) {
  const scored = cases.map((item) => item[provider]).filter((item) => item.status === 'completed');
  if (scored.length !== cases.length) return { status: 'blocked', completedCases: scored.length, totalCases: cases.length };
  const result = { status: 'completed', completedCases: scored.length, totalCases: cases.length };
  for (const metric of METRICS) result[metric] = scored.reduce((sum, item) => sum + item[metric], 0) / scored.length;
  for (const metric of ['completionSeconds','userEffortMinutes']) result[metric] = scored.reduce((sum, item) => sum + item[metric], 0);
  const costs = scored.map((item) => item.costUsd).filter((value) => value != null);
  result.costUsd = costs.length === scored.length ? costs.reduce((sum, value) => sum + value, 0) : null;
  return result;
}

function evaluateGate(result, thresholds) {
  if (result.status !== 'completed') return { status: 'blocked', reasons: ['Every benchmark case must be completed.'] };
  const map = { recall:'candidateRecall', phraseRecall:'phraseRecall', contextualMeaningAccuracy:'contextualMeaningAccuracy', senseDecisionAccuracy:'senseDecisionAccuracy', taxonomyAccuracy:'taxonomyAccuracy', eightSectionQuality:'eightSectionQuality', schemaCompliance:'schemaCompliance', tamilSemanticScore:'tamilSemanticScore', tamilNaturalnessScore:'tamilNaturalnessScore' };
  const reasons = Object.entries(map).filter(([metric, threshold]) => result[metric] < thresholds[threshold]).map(([metric, threshold]) => `${metric} ${result[metric]} is below ${thresholds[threshold]}`);
  return { status: reasons.length ? 'failed' : 'passed', reasons };
}

function validateInput(document) {
  if (document.schemaVersion !== 'provider-benchmark-input-v2') throw new Error('Expected provider-benchmark-input-v2.');
  if (!Array.isArray(document.cases) || document.cases.length === 0) throw new Error('At least one benchmark case is required.');
  const ids = new Set();
  for (const entry of document.cases) { if (!entry.id || ids.has(entry.id)) throw new Error(`Case IDs must be present and unique: ${entry.id || '<missing>'}`); ids.add(entry.id); if (!entry.sourceHash || !entry.gold?.candidates?.length) throw new Error(`Case ${entry.id} requires sourceHash and gold candidates.`); }
}

function benchmark(document) {
  validateInput(document);
  const cases = document.cases.map((entry) => ({ id: entry.id, sourceHash: entry.sourceHash, chatgpt: scoreCase(entry.gold, entry.chatgpt), gemini: scoreCase(entry.gold, entry.gemini) }));
  const aggregates = { chatgpt: aggregate(cases, 'chatgpt'), gemini: aggregate(cases, 'gemini') };
  return { schemaVersion:'provider-benchmark-report-v2', generatedAt:new Date().toISOString(), benchmarkVersion:document.benchmarkVersion, thresholds:document.thresholds, cases, aggregates, rolloutGate:evaluateGate(aggregates.gemini, document.thresholds) };
}

if (require.main === module) { const [input, output] = process.argv.slice(2); if (!input || !output) { console.error('Usage: node scripts/benchmark-providers.js <results.json> <report.json>'); process.exit(2); } try { fs.writeFileSync(output, `${JSON.stringify(benchmark(JSON.parse(fs.readFileSync(input, 'utf8'))), null, 2)}\n`); } catch (error) { console.error(error.message); process.exit(1); } }
module.exports = { aggregate, benchmark, evaluateGate, scoreCase, validateInput };
