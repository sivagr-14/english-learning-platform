import { STARTER_SAMPLES } from "../data/starter-samples";
import { GeneratedPackEntrySchema } from "./content-pack-contract";
import { vocabularyLessonQualityIssues } from "../data/vocabulary-lesson-template";

describe.each(["chatgpt", "gemini"])("%s provider-neutral lesson contract", (provider) => {
  it("accepts the same complete simplified-v2 fixture", () => {
    const sample = STARTER_SAMPLES[0];
    const result = GeneratedPackEntrySchema.parse({
      candidateId: `${provider}-candidate-001`, word: sample.word,
      pronunciation: sample.pronunciation, wordType: sample.wordType,
      englishMeaning: sample.englishMeaning, tamilMeaning: sample.tamilMeaning,
      coreIdea: sample.coreIdea, lesson: sample.lesson,
    });
    expect(vocabularyLessonQualityIssues(result.lesson, result.word)).toEqual([]);
  });

  it("rejects an incomplete lesson instead of reporting false completion", () => {
    const sample = STARTER_SAMPLES[0];
    expect(() => GeneratedPackEntrySchema.parse({
      candidateId: `${provider}-candidate-bad`, word: sample.word,
      pronunciation: sample.pronunciation, wordType: sample.wordType,
      englishMeaning: sample.englishMeaning, tamilMeaning: sample.tamilMeaning,
      coreIdea: sample.coreIdea,
      lesson: { ...sample.lesson, advanced_nuance: [] },
    })).toThrow();
  });
});
