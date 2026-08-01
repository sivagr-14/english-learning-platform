import { STARTER_SAMPLES } from "../data/starter-samples";
import {
  validateVocabularyImportEntry,
  VocabularyImportRow,
} from "./vocabulary-import.service";

function compliantImport(): VocabularyImportRow {
  const sample = STARTER_SAMPLES[0];
  return {
    category: sample.categoryName,
    word: sample.word,
    pronunciation: sample.pronunciation,
    word_type: sample.wordType,
    item_type: sample.itemType,
    cefr_level: sample.cefrLevel,
    frequency: "High",
    english_meaning: sample.englishMeaning,
    tamil_meaning: sample.tamilMeaning,
    core_idea: sample.coreIdea,
    lesson_data: sample.lesson,
  };
}

describe("vocabulary import compliance", () => {
  it("accepts a complete eight-section lesson", () => {
    const entry = compliantImport();
    expect(validateVocabularyImportEntry(entry)).toEqual(entry.lesson_data);
  });

  it("rejects a vocabulary row without the complete lesson", () => {
    const entry = compliantImport();
    delete entry.lesson_data;

    expect(() => validateVocabularyImportEntry(entry)).toThrow(
      "must provide lesson_data using the simplified-v2 eight-section format",
    );
  });

  it("rejects an update when one section contains filler", () => {
    const entry = compliantImport();
    const lesson = JSON.parse(JSON.stringify(entry.lesson_data));
    lesson.advanced_nuance = ["Placeholder text"];
    entry.lesson_data = lesson;

    expect(() => validateVocabularyImportEntry(entry)).toThrow(
      "incomplete or generic",
    );
  });

  it("rejects a CEFR label outside A1 through C2", () => {
    const entry = compliantImport();
    entry.cefr_level = "advanced";

    expect(() => validateVocabularyImportEntry(entry)).toThrow(
      "Use A1, A2, B1, B2, C1 or C2",
    );
  });

  it("requires a complete contextual sense contract when sense metadata begins", () => {
    const entry = compliantImport();
    entry.sense_decision = "new_sense";

    expect(() => validateVocabularyImportEntry(entry)).toThrow(
      /missing contextual sense fields/i,
    );
  });

  it("rejects a display suffix in the stored word", () => {
    const entry = compliantImport();
    entry.word = `${entry.word} (B)`;
    entry.contextual_meaning = entry.english_meaning;
    entry.sense_decision = "new_sense";
    entry.sense_key = "clear-and-uncomplicated";
    entry.sense_evidence = {
      sentence: "The process was straightforward.",
      explanation:
        "Straightforward means that the process was clear and uncomplicated.",
    };

    expect(() => validateVocabularyImportEntry(entry)).toThrow(
      /real term without a sense suffix/i,
    );
  });
});
