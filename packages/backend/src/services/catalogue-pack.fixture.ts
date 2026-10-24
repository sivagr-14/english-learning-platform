import { STARTER_SAMPLES } from "../data/starter-samples";
import { catalogueHash, CATALOGUE_SELECTION_POLICY_ID } from "./catalogue-contract";
import { contentPackHash } from "./content-pack-contract";

/** Authored test fixture only; not evidence of a real catalogue assessment. */
export function cataloguePackFixture(): { manifest: any; batch: any } {
  const samples = STARTER_SAMPLES.filter(sample => sample.word === "charge");
  const sourceHash = "a".repeat(64);
  const recordId = `wordup-${sourceHash.slice(0, 16)}-1`;
  const raw = { wordId: 1, rank: 1, personalRank: 1, text: "charge", otherForms: "charged,charging",
    primaryMeaning: samples[0].englishMeaning, primarySenseId: "untrusted-source-id", type: 1,
    britishPhonetic: samples[0].pronunciation, americanPhonetic: null };
  const preparation: any = {
    formatVersion: "wordup-catalogue-preparation-v1",
    source: { sha256: sourceHash, table: "words", recordCount: 1 },
    policy: { includedCefrLevels: ["B1", "B2", "C1"], includedFrequencies: ["heavy", "medium"],
      evidenceType: "catalogue_definition", teachingExampleOrigin: "authored_for_learning", sourceSentenceAvailable: false,
      rankIsLevelOrFrequencyEvidence: false, importSourceLearningState: false, existingVocabularyCheck: "required_in_local_app" },
    records: [{ recordId, recordHash: catalogueHash(raw), source: raw, evidenceType: "catalogue_definition", flags: ["invalid_source_sense_id"] }],
    assessmentGroups: [{ groupId: "group-00001", recordIds: [recordId] }],
    audit: { records: 1, groupedRecords: 1, untracked: 0, words: 1, expressions: 0, unknownTypes: 0, flagCounts: { invalid_source_sense_id: 1 } },
  };
  preparation.preparationHash = catalogueHash(preparation);
  const candidates = samples.map((sample, index) => ({
    candidateId: `charge-meaning-${index + 1}`, term: "charge", baseForm: "charge", itemType: "word",
    decision: "generate", operation: "new", senseDecision: "new_sense", senseKey: sample.canonicalKey.split("|")[1],
    cefrLevel: "B2", usageFrequency: "medium", fluencyValue: "useful",
    categoryName: "Practice and improvement", contextualMeaning: sample.englishMeaning,
    taxonomy: { taxonomyVersion: "2026.1", domainKey: "education", usageGroupKey: "education.study_skills",
      categoryKey: "education.study_skills.practice_and_improvement", confidence: "high" },
    senseEvidence: { sentence: sample.lesson.meaning_in_context.source_sentence, explanation: "An authored test scenario demonstrates this individual meaning." },
    occurrences: [{ page: 1, chunkId: "group-00001", sentence: sample.lesson.meaning_in_context.source_sentence }],
    evidenceType: "catalogue_definition_with_authored_example",
    catalogueEvidence: { recordIds: [recordId], meaningOrigin: index === 0 ? "supplied_definition" : "additional_meaning",
      exampleOrigin: "authored_for_learning", learningValue: "non_obvious",
      learningValueReason: "This synthetic sense requires interpretation beyond a predictable literal combination.", levelReason: "Fixture-only linguistic level assessment for contract testing.",
      usageReason: "Fixture-only assessment of usefulness in ordinary communication.", assessmentBasis: "linguistic_assessment",
      references: index === 0 ? [] : [{ url: "https://example.org/fixture-meaning", supports: "meaning", explanation: "Synthetic reference for tests; never a real assessment claim." }] },
  }));
  const manifest: any = {
    formatVersion: "chatgpt-catalogue-vocabulary-manifest-v1", manifestId: "catalogue-charge-fixture", createdAt: "2026-10-23T12:00:00.000Z",
    source: { name: "Synthetic catalogue fixture", type: "catalogue", contentHash: sourceHash, totalPages: 1, totalChunks: 1 },
    coverage: { pages: [{ page: 1, status: "assessed", chunkIds: ["group-00001"] }],
      chunks: [{ chunkId: "group-00001", pageStart: 1, pageEnd: 1, status: "assessed", candidateIds: candidates.map(candidate => candidate.candidateId) }] },
    candidates,
    catalogueAudit: { selectionPolicy: {
      policyId: CATALOGUE_SELECTION_POLICY_ID, eligibleLevels: ["B1", "B2", "C1", "C2"],
      priorityLevels: ["B2", "C1", "C2"], includedFrequencies: ["heavy", "medium"],
      excludeBasicObvious: true, excludePredictableCombinations: true, excludeRareSpecialist: true,
      preserveNonObviousExpressions: true, expandBasicHeadwords: false,
    }, preparation, recordReviews: [{ recordId, status: "assessed", candidateIds: candidates.map(candidate => candidate.candidateId),
      additionalMeaningsReviewed: true, reason: "Three meanings included in this synthetic fixture only." }] },
    counts: { totalCandidates: candidates.length, generate: candidates.length, existing: 0, filtered: 0, rejected: 0, heavyUse: 0, mediumUse: candidates.length },
    generationPlan: { batchSize: 100, batches: [{ batchNumber: 1, candidateIds: candidates.map(candidate => candidate.candidateId) }] },
  };
  const batch = {
    formatVersion: "chatgpt-catalogue-vocabulary-batch-v1", batchId: "catalogue-charge-fixture-batch-001", manifestId: manifest.manifestId,
    manifestHash: contentPackHash(manifest), batchNumber: 1, createdAt: manifest.createdAt,
    entries: samples.map((sample, index) => ({ candidateId: candidates[index].candidateId, word: sample.word,
      pronunciation: sample.pronunciation, wordType: sample.wordType, englishMeaning: sample.englishMeaning,
      tamilMeaning: sample.tamilMeaning, coreIdea: sample.coreIdea,
      lesson: { ...sample.lesson, meaning_in_context: { ...sample.lesson.meaning_in_context, example_origin: "authored_for_learning" } } })),
  };
  return { manifest, batch };
}

