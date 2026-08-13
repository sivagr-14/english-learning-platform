import {
  assertVocabularyLessonCompliant,
  vocabularyLessonQualityIssues,
  VocabularyLesson,
  VOCABULARY_LESSON_FORMAT_VERSION,
  vocabularyExpressionCompatibilityIssues,
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

  it("accepts short non-empty immutable evidence without weakening generated prose", () => {
    const lesson = completeLesson();
    const sourceSentence = "(Gulp .";
    lesson.meaning_in_context.source_sentence = sourceSentence;

    const issues = vocabularyLessonQualityIssues(lesson, "gulp", {
      trustedSourceSentence: sourceSentence,
    });

    expect(issues).not.toContain(
      "lesson.meaning_in_context.source_sentence: must contain useful content",
    );
    expect(issues).not.toContain(
      'lesson.meaning_in_context.source_sentence: must explicitly demonstrate "gulp"',
    );
    expect(
      vocabularyLessonQualityIssues(
        {
          ...lesson,
          meaning_in_context: {
            ...lesson.meaning_in_context,
            contextual_meaning: "short",
          },
        },
        "gulp",
        { trustedSourceSentence: sourceSentence },
      ),
    ).toContain(
      "lesson.meaning_in_context.contextual_meaning: must contain useful content",
    );
  });

  it("rejects blank immutable source evidence", () => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence = "   ";

    expect(vocabularyLessonQualityIssues(lesson, TERM)).toContain(
      "lesson.meaning_in_context.source_sentence: must contain immutable source evidence",
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

  it.each([
    ["bring into contact with", "The workshop brought me into contact with experienced editors."],
    ["get back on track", "A short break got the discussion back on track."],
    ["watch like a hawk", "The supervisor watched them like a hawk."],
    ["stumble through", "We stumbled our way through the first rehearsal."],
    ["steer away from", "She steered completely away from personal criticism."],
    ["work out", "They eventually worked the disagreement out."],
  ])("accepts a bounded separable realization of %s", (term, sentence) => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence = sentence;

    expect(vocabularyLessonQualityIssues(lesson, term)).not.toContain(
      `lesson.meaning_in_context.source_sentence: must explicitly demonstrate "${term}"`,
    );
  });

  it.each([
    ["shut someone down", "The chair shut the nervous new speaker down."],
    ["let someone down", "I do not want to let my closest colleagues down."],
    ["at someone's cue", "At the principal's cue, the orchestra began."],
    ["go out of your way", "She went out of her way to help."],
    ["pull oneself out of", "He pulled himself out of the argument."],
  ])("accepts grammatical placeholder realization of %s", (term, sentence) => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence = sentence;

    expect(vocabularyLessonQualityIssues(lesson, term)).not.toContain(
      `lesson.meaning_in_context.source_sentence: must explicitly demonstrate "${term}"`,
    );
  });

  it("accepts reciprocal possessives in exact immutable OCR evidence", () => {
    const lesson = completeLesson();
    const sourceSentence = "They began to get on each other's nerv es.";
    lesson.meaning_in_context.source_sentence = sourceSentence;

    expect(
      vocabularyLessonQualityIssues(lesson, "get on someone's nerves", {
        trustedSourceSentence: sourceSentence,
      }),
    ).not.toContain(
      'lesson.meaning_in_context.source_sentence: must explicitly demonstrate "get on someone\'s nerves"',
    );
  });

  it.each([
    ["bring into contact with", "The workshop did not bring contact with experienced editors."],
    ["get back on track", "They get discouraged and never return back on track."],
    ["work out", "We work carefully without resolving it out."],
    ["practice makes perfect", "Practice does not make perfect."],
  ])("rejects a negated, missing, or non-separable lookalike for %s", (term, sentence) => {
    const lesson = completeLesson();
    lesson.meaning_in_context.source_sentence = sentence;

    expect(vocabularyLessonQualityIssues(lesson, term)).toContain(
      `lesson.meaning_in_context.source_sentence: must explicitly demonstrate "${term}"`,
    );
  });

  it("trusts immutable OCR evidence only when the entry validator receives its exact sentence", () => {
    const lesson = completeLesson();
    const sourceSentence = "The topic involved p hysical intima cy.";
    lesson.meaning_in_context.source_sentence = sourceSentence;

    expect(vocabularyLessonQualityIssues(lesson, "physical intimacy")).toContain(
      'lesson.meaning_in_context.source_sentence: must explicitly demonstrate "physical intimacy"',
    );
    expect(
      vocabularyLessonQualityIssues(lesson, "physical intimacy", {
        trustedSourceSentence: sourceSentence,
      }),
    ).not.toContain(
      'lesson.meaning_in_context.source_sentence: must explicitly demonstrate "physical intimacy"',
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

  it.each([
    ["lay out", "Do not write: lay the details.", "Lay out the details in a clear sequence."],
    ["go on", "Do not use only go for continuation.", "The meeting can go on after lunch."],
    ["do up", "Do not omit the particle from do up.", "Please do up your coat before leaving."],
    ["put off", "Do not use put alone for postponement.", "We should not put off the decision."],
  ])(
    "validates short-word expressions in Mistakes & Differences with the shared matcher: %s",
    (term, commonMistake, correction) => {
      const lesson = completeLesson();
      lesson.mistakes_differences.common_mistake = commonMistake;
      lesson.mistakes_differences.correction = correction;

      expect(vocabularyLessonQualityIssues(lesson, term)).not.toContain(
        `lesson.mistakes_differences: the mistake or correction must explicitly use "${term}"`,
      );
    },
  );

  it("does not accept only the head verb when a short particle is required", () => {
    const lesson = completeLesson();
    lesson.mistakes_differences.common_mistake =
      "The writer lays the information before the reader.";
    lesson.mistakes_differences.correction =
      "The writer presents the sequence clearly.";

    expect(vocabularyLessonQualityIssues(lesson, "lay out")).toContain(
      'lesson.mistakes_differences: the mistake or correction must explicitly use "lay out"',
    );
  });

  it.each([
    "lay out",
    "go on",
    "do up",
    "put off",
    "as is",
    "by and by",
    "get on someone’s nerves",
    "bring into contact with",
  ])("preflights a canonical expression through the shared matcher: %s", (term) => {
    expect(vocabularyExpressionCompatibilityIssues(term)).toEqual([]);
  });


  it("accepts ordered expression components across one teaching unit", () => {
    const lesson = completeLesson();
    lesson.mistakes_differences.common_mistake =
      "Using compelling as if it simply meant an argument you agree with.";
    lesson.mistakes_differences.correction =
      "Use compelling when the reasoning is strongly convincing.";

    expect(
      vocabularyLessonQualityIssues(lesson, "a compelling argument"),
    ).not.toContain(
      'lesson.mistakes_differences: the mistake or correction must explicitly use "a compelling argument"',
    );
  });

});
