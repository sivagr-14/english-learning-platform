import { STARTER_SAMPLES, STARTER_SAMPLE_VERSION } from "../data/starter-samples";
import { assertVocabularyLessonCompliant } from "../data/vocabulary-lesson-template";

test("charge samples teach three distinct senses through complete validated lessons", () => {
  const senses = STARTER_SAMPLES.filter(sample => sample.word === "charge");
  expect(senses).toHaveLength(3);
  expect(new Set(senses.map(sample => sample.canonicalKey)).size).toBe(3);
  expect(new Set(senses.map(sample => sample.englishMeaning)).size).toBe(3);
  for (const sample of senses) {
    expect(sample.cefrLevel).toBe("B2");
    expect(sample.lesson.sample_version).toBe(STARTER_SAMPLE_VERSION);
    expect(sample.lesson.meaning_in_context.contextual_meaning).toBe(sample.englishMeaning);
    expect(sample.tamilMeaning).toMatch(/[\u0B80-\u0BFF]/);
    expect(() => assertVocabularyLessonCompliant(sample.lesson, sample.word)).not.toThrow();
  }
});
