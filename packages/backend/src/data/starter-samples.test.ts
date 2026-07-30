import { STARTER_SAMPLES, STARTER_SAMPLE_KEYS } from "./starter-samples";

describe("starter samples", () => {
  it("cover multiple CEFR levels and item types", () => {
    expect(new Set(STARTER_SAMPLES.map((sample) => sample.cefrLevel))).toEqual(
      new Set(["B2", "C1", "C2"]),
    );
    expect(new Set(STARTER_SAMPLES.map((sample) => sample.itemType)).size).toBe(
      STARTER_SAMPLES.length,
    );
  });

  it("use unique stable identities", () => {
    expect(new Set(STARTER_SAMPLE_KEYS).size).toBe(STARTER_SAMPLES.length);
    expect(
      new Set(
        STARTER_SAMPLES.map(
          (sample) => `${sample.categoryName}:${sample.word.toLowerCase()}`,
        ),
      ).size,
    ).toBe(STARTER_SAMPLES.length);
  });

  it("include the learning fields used by vocabulary and review screens", () => {
    for (const sample of STARTER_SAMPLES) {
      expect(sample.englishMeaning).toBeTruthy();
      expect(sample.tamilMeaning).toBeTruthy();
      expect(sample.coreIdea).toBeTruthy();
      expect(sample.lesson).toMatchObject({
        sample_notice: expect.any(String),
        memory_mastery: {
          memory_sentence: expect.any(String),
          recall_question: expect.any(String),
        },
        usage_mastery: {
          when_to_use: expect.any(Array),
          when_not_to_use: expect.any(Array),
        },
        application: {
          examples: expect.any(Object),
          collocations: expect.any(Array),
        },
        mastery: {
          guided_practice: expect.any(Array),
        },
      });
    }
  });
});
