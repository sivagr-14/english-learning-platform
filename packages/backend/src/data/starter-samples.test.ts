import {
  STARTER_SAMPLES,
  STARTER_SAMPLE_KEYS,
  STARTER_SAMPLE_VERSION,
} from "./starter-samples";
import {
  vocabularyLessonQualityIssues,
  VOCABULARY_LESSON_FORMAT_VERSION,
  VOCABULARY_SECTION_TEMPLATE,
} from "./vocabulary-lesson-template";
import { buildNavigation } from "../services/vocabulary-browse.service";

describe("starter samples", () => {
  it("cover multiple CEFR levels and item types", () => {
    expect(new Set(STARTER_SAMPLES.map((sample) => sample.cefrLevel))).toEqual(
      new Set(["B2", "C1", "C2"]),
    );
    expect(
      Array.from(new Set(STARTER_SAMPLES.map((sample) => sample.itemType))),
    ).toEqual(expect.arrayContaining(["word", "collocation", "idiom"]));
  });

  it("provides three navigable words in every starter category", () => {
    const byCategory = new Map<string, (typeof STARTER_SAMPLES)[number][]>();

    for (const sample of STARTER_SAMPLES) {
      const samples = byCategory.get(sample.categoryName) || [];
      samples.push(sample);
      byCategory.set(sample.categoryName, samples);
    }

    expect(byCategory.size).toBe(4);
    expect(STARTER_SAMPLES).toHaveLength(12);

    for (const samples of byCategory.values()) {
      const rows = [...samples]
        .sort((left, right) => left.word.localeCompare(right.word))
        .map((sample) => ({ id: sample.canonicalKey }));

      expect(rows).toHaveLength(3);
      expect(buildNavigation(rows, rows[0].id)).toMatchObject({
        previous_id: null,
        next_id: rows[1].id,
        position: 1,
        total: 3,
      });
      expect(buildNavigation(rows, rows[1].id)).toMatchObject({
        previous_id: rows[0].id,
        next_id: rows[2].id,
        position: 2,
        total: 3,
      });
      expect(buildNavigation(rows, rows[2].id)).toMatchObject({
        previous_id: rows[1].id,
        next_id: null,
        position: 3,
        total: 3,
      });
    }
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

  it("use the complete simplified lesson structure", () => {
    for (const sample of STARTER_SAMPLES) {
      expect(sample.englishMeaning).toBeTruthy();
      expect(sample.tamilMeaning).toBeTruthy();
      expect(sample.coreIdea).toBeTruthy();
      expect(sample.lesson).toMatchObject({
        format_version: VOCABULARY_LESSON_FORMAT_VERSION,
        sample_version: STARTER_SAMPLE_VERSION,
        sample_notice: expect.any(String),
        overview: {
          meaning_usage_profile: {
            meaning_type: expect.any(String),
            connotation: expect.any(String),
            tone: expect.any(String),
            register: expect.any(String),
          },
        },
        meaning_in_context: {
          source_sentence: expect.any(String),
          contextual_meaning: expect.any(String),
          simple_explanation: expect.any(String),
        },
        usage_guide: {
          when_to_use: expect.any(Array),
          when_not_to_use: expect.any(Array),
        },
        patterns_collocations: {
          main_pattern: expect.any(String),
          common_collocations: expect.any(Array),
        },
        natural_examples: {
          examples: expect.any(Object),
          mini_conversation: expect.any(String),
        },
        mistakes_differences: {
          common_mistake: expect.any(String),
          correction: expect.any(String),
          important_difference: expect.any(String),
        },
        memory_practice: {
          memory_trigger: expect.any(String),
          memory_sentence: expect.any(String),
          recall_question: expect.any(String),
          recognition_task: expect.any(String),
          production_task: expect.any(String),
        },
        advanced_nuance: expect.any(Array),
      });

      const lesson = sample.lesson as any;
      expect(Object.keys(lesson.overview.meaning_usage_profile)).toEqual([
        "meaning_type",
        "connotation",
        "tone",
        "register",
      ]);
      expect(lesson.usage_guide.when_to_use.length).toBeGreaterThan(0);
      expect(lesson.usage_guide.when_not_to_use.length).toBeGreaterThan(0);
      expect(
        lesson.patterns_collocations.common_collocations.length,
      ).toBeGreaterThan(0);
      expect(
        Object.keys(lesson.natural_examples.examples).length,
      ).toBeGreaterThan(1);
      expect(lesson.advanced_nuance.length).toBeGreaterThan(0);
      expect(vocabularyLessonQualityIssues(lesson, sample.word)).toEqual([]);
    }
  });

  it("populates all eight required sections", () => {
    const lessonKeys = [
      "overview",
      "meaning_in_context",
      "usage_guide",
      "patterns_collocations",
      "natural_examples",
      "mistakes_differences",
      "memory_practice",
      "advanced_nuance",
    ];

    expect(VOCABULARY_SECTION_TEMPLATE).toHaveLength(8);
    for (const sample of STARTER_SAMPLES) {
      expect(lessonKeys.every((key) => key in sample.lesson)).toBe(true);
    }
  });

  it("does not retain noisy legacy lesson sections", () => {
    for (const sample of STARTER_SAMPLES) {
      expect(sample.lesson).not.toHaveProperty("meaning_expansion");
      expect(sample.lesson).not.toHaveProperty("usage_mastery");
      expect(sample.lesson).not.toHaveProperty("application");
      expect(sample.lesson).not.toHaveProperty("mastery");
    }
  });
});
