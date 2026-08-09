import {
  generatedVocabularyEntryQualityIssues,
  VOCABULARY_ENTRY_RESPONSE_SCHEMA,
} from "../data/vocabulary-lesson-template";

function validEntry() {
  return {
    word: "bank",
    pronunciation: "/bæŋk/",
    wordType: "noun",
    englishMeaning: "a financial institution that holds and manages money",
    tamilMeaning: "பணத்தை வைத்திருந்து நிர்வகிக்கும் நிதி நிறுவனம்",
    coreIdea: "A bank safely holds and manages customers' money.",
    lesson: {
      format_version: "simplified-v2",
      overview: {
        meaning_usage_profile: {
          meaning_type: "A tangible institution and an abstract financial service.",
          connotation: "Neutral unless the surrounding financial event changes it.",
          tone: "Neutral and factual in this source context.",
          register: "Standard in everyday and professional English.",
        },
      },
      meaning_in_context: {
        source_sentence: "She deposited the money at the bank.",
        contextual_meaning: "a financial institution that holds and manages money",
        simple_explanation: "Here, bank means the institution where she keeps money.",
      },
      usage_guide: {
        when_to_use: ["Use bank for an institution providing financial services."],
        when_not_to_use: ["Do not use bank for the sloping side of a river here."],
      },
      patterns_collocations: {
        main_pattern: "deposit money at a bank",
        common_collocations: ["local bank branch", "bank account"],
      },
      natural_examples: {
        examples: {
          daily: "I opened an account at the bank.",
          professional: "The bank approved the business loan.",
        },
        mini_conversation: "A: Is the bank open? B: Yes, until five o'clock.",
      },
      mistakes_differences: {
        common_mistake: "I deposited the bank yesterday.",
        correction: "I deposited money at the bank yesterday.",
        important_difference: "A bank is the institution; a bank account is the service record.",
      },
      memory_practice: {
        memory_trigger: "Picture a secure building holding your money.",
        memory_sentence: "She deposited the money at the bank.",
        recall_question: "Where would you deposit money safely?",
        recognition_task: "Choose the sentence where bank means a financial institution.",
        production_task: "Write a sentence about opening an account at a bank.",
      },
      advanced_nuance: [
        "Bank can also mean a river edge, but deposited money selects the financial sense.",
      ],
    },
  };
}

describe("Gemini Phase 2 structured generation and semantic gates", () => {
  it("publishes one complete provider schema for headers and eight lesson sections", () => {
    expect(VOCABULARY_ENTRY_RESPONSE_SCHEMA.required).toEqual(
      expect.arrayContaining([
        "word", "tamilMeaning", "overview", "meaning_in_context",
        "usage_guide", "patterns_collocations", "natural_examples",
        "mistakes_differences", "memory_practice", "advanced_nuance",
      ]),
    );
  });

  it("accepts a source-grounded contextual entry", () => {
    expect(generatedVocabularyEntryQualityIssues(validEntry(), {
      term: "bank",
      contextualMeaning: "a financial institution that holds and manages money",
      sourceSentence: "She deposited the money at the bank.",
    })).toEqual([]);
  });

  it("rejects sense drift, altered evidence, non-Tamil output and placeholders", () => {
    const entry = validEntry();
    entry.englishMeaning = "the sloping land beside a river";
    entry.tamilMeaning = "financial institution";
    entry.coreIdea = "TBD";
    entry.lesson.meaning_in_context.source_sentence = "The boat reached the bank.";

    expect(generatedVocabularyEntryQualityIssues(entry, {
      term: "bank",
      contextualMeaning: "a financial institution that holds and manages money",
      sourceSentence: "She deposited the money at the bank.",
    })).toEqual(expect.arrayContaining([
      "englishMeaning must exactly equal the assessed contextual meaning",
      "source sentence must exactly equal the recorded evidence sentence",
      "Tamil meaning must contain natural Tamil text",
      "entry.coreIdea: contains placeholder text",
    ]));
  });
});
