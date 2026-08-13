import {
  assertVocabularyLessonCompliant,
  vocabularyLessonQualityIssues,
  VocabularyLesson,
  VOCABULARY_LESSON_FORMAT_VERSION,
} from "./vocabulary-lesson-template";

const TERM = "follow through";

function completeLesson(): VocabularyLesson {
  return {
    format_version: VOCABULARY_LESSON_FORMAT_VERSION,
    overview: {
      meaning_usage_profile: {
        meaning_type: "Idiomatic and abstract",
        connotation: "Positive when it shows reliability",
        tone: "Responsible and determined",
        register: "Neutral in everyday and professional English",
      },
    },
    meaning_in_context: {
      source_sentence:
        "She promised to contact the client and followed through the next morning.",
      contextual_meaning:
        "She completed the action that she had previously promised.",
      simple_explanation:
        "Follow through means carrying an intention or promise through to completion.",
    },
    usage_guide: {
      when_to_use: [
        "Use follow through when somebody completes a promise, plan or responsibility.",
      ],
      when_not_to_use: [
        "Do not use follow through for an action that was never planned or promised.",
      ],
    },
    patterns_collocations: {
      main_pattern:
        "follow through; follow through on + promise, plan or commitment",
      common_collocations: [
        "follow through on a promise",
        "follow through with the plan",
      ],
    },
    natural_examples: {
      examples: {
        everyday: "I said I would help, so I need to follow through.",
        professional:
          "A reliable manager follows through on every agreed action.",
      },
      mini_conversation:
        "A: Did Ravi do what he promised?\nB: Yes, he followed through immediately.",
    },
    mistakes_differences: {
      common_mistake: "She followed through her promise.",
      correction: "She followed through on her promise.",
      important_difference:
        "Follow through stresses completion; carry on stresses continuation.",
    },
    memory_practice: {
      memory_trigger:
        "Picture a runner crossing the finish line instead of stopping halfway.",
      memory_sentence:
        "Reliable people follow through on the promises they make.",
      recall_question:
        "Which phrasal verb means completing a promised or planned action?",
      recognition_task:
        "Choose where follow through fits: making a promise or completing it.",
      production_task:
        "Describe one commitment you need to follow through on this week.",
    },
    advanced_nuance: [
      "Follow through can be intransitive, but follow through on identifies the promise or plan that is completed.",
    ],
  };
}

describe("vocabulary lesson compliance", () => {
  it("accepts a complete, term-specific eight-section lesson", () => {
    expect(assertVocabularyLessonCompliant(completeLesson(), TERM)).toEqual(
      completeLesson(),
    );
  });

  it("rejects an empty required section", () => {
    const lesson = completeLesson() as any;
    lesson.advanced_nuance = [];

    expect(vocabularyLessonQualityIssues(lesson, TERM)).toContain(
      "lesson.advanced_nuance: must not be empty",
    );
  });

  it.each([
    "TODO",
    "Placeholder text",
    "Not added",
    "Use it when appropriate",
    "This is a useful word in many situations",
  ])("rejects filler content: %s", (filler) => {
    const lesson = completeLesson();
    lesson.overview.meaning_usage_profile.tone = filler;

    expect(vocabularyLessonQualityIssues(lesson, TERM)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("lesson.overview.meaning_usage_profile.tone"),
      ]),
    );
  });

  it("rejects content that does not demonstrate the target term", () => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence =
      "She completed the task the next morning.";

    expect(vocabularyLessonQualityIssues(lesson, TERM)).toContain(
      'lesson.meaning_in_context.source_sentence: must explicitly demonstrate "follow through"',
    );
  });

  it.each([
    ["grow up with", "She has grown up with strong family support."],
    ["grow up with", "He grew up with three older brothers."],
    ["take on", "She has taken on a difficult assignment."],
    ["run into", "We ran into an unexpected problem."],
    ["carry through", "They carried through the promised reform."],
  ])("accepts an ordered source-backed inflection of %s", (term, sentence) => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence = sentence;

    expect(vocabularyLessonQualityIssues(lesson, term)).not.toContain(
      `lesson.meaning_in_context.source_sentence: must explicitly demonstrate "${term}"`,
    );
  });

  it("rejects scattered words that do not form the assessed expression", () => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence =
      "The children grow quickly and later catch up with their classmates.";

    expect(vocabularyLessonQualityIssues(lesson, "grow up with")).toContain(
      'lesson.meaning_in_context.source_sentence: must explicitly demonstrate "grow up with"',
    );
  });

  it("rejects a lexical prefix that changes the expression", () => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence =
      "Some children grow up without consistent support.";

    expect(vocabularyLessonQualityIssues(lesson, "grow up with")).toContain(
      'lesson.meaning_in_context.source_sentence: must explicitly demonstrate "grow up with"',
    );
  });
});
