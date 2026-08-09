const assert = require('node:assert/strict');
const test = require('node:test');
const { benchmark, scoreCase } = require('./benchmark-providers');
const gold = { candidates: [
  { term:'bank',senseKey:'money',itemType:'word',contextualMeaning:'financial institution',senseDecision:'new_sense',taxonomy:['daily','money','banking'] },
  { term:'bank',senseKey:'river',itemType:'word',contextualMeaning:'land by a river',senseDecision:'new_sense',taxonomy:['nature','water','rivers'] },
  { term:'carry out',senseKey:'perform',itemType:'phrasal verb',contextualMeaning:'perform a task',senseDecision:'new_sense',taxonomy:['work','tasks','execution'] },
] };
const completed = () => ({ status:'completed',candidates:gold.candidates.map((item)=>({...item,schemaValid:true,eightSectionValid:true})),tamilSemanticScore:4.5,tamilNaturalnessScore:4,completionSeconds:10,userEffortMinutes:1,costUsd:.01 });
const thresholds = { candidateRecall:.9,phraseRecall:.85,contextualMeaningAccuracy:.95,senseDecisionAccuracy:.95,taxonomyAccuracy:.9,eightSectionQuality:.9,schemaCompliance:1,tamilSemanticScore:4,tamilNaturalnessScore:4 };

test('scores contextual meaning, sense decision and eight-section quality',()=>{ const actual=completed(); actual.candidates[1].contextualMeaning='financial institution'; actual.candidates[2].eightSectionValid=false; const score=scoreCase(gold,actual); assert.equal(score.recall,1); assert.equal(score.contextualMeaningAccuracy,2/3); assert.equal(score.senseDecisionAccuracy,1); assert.equal(score.eightSectionQuality,2/3); });
test('missing execution blocks instead of becoming zero',()=>assert.deepEqual(scoreCase(gold,{status:'not_run',reason:'No API key'}),{status:'not_run',blockingReasons:['No API key']}));
test('aggregates completed cases and passes thresholds',()=>{ const report=benchmark({schemaVersion:'provider-benchmark-input-v2',benchmarkVersion:'gold-v1',thresholds,cases:[{id:'polysemy',sourceHash:'abc',gold,chatgpt:completed(),gemini:completed()}]}); assert.equal(report.aggregates.gemini.recall,1); assert.equal(report.rolloutGate.status,'passed'); });
test('blocks gate when any case was not run',()=>{ const report=benchmark({schemaVersion:'provider-benchmark-input-v2',benchmarkVersion:'gold-v1',thresholds,cases:[{id:'polysemy',sourceHash:'abc',gold,chatgpt:completed(),gemini:{status:'not_run'}}]}); assert.equal(report.rolloutGate.status,'blocked'); });
