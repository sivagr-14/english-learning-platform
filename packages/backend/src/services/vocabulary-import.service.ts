import { Knex } from "knex";
import { Frequency, VocabularyLessonSample } from "../data/vocabulary-lesson-samples";
import { VOCABULARY_SECTION_TEMPLATE } from "../data/vocabulary-lesson-template";

export interface VocabularyImportRow {
  track?: string;
  category?: string;
  categoryId?: string;
  _categoryCandidates?: string[];
  word: string;
  pronunciation?: string;
  word_type?: string;
  cefr_level?: string;
  frequency?: "High" | "Medium" | "Low" | string;
  english_meaning: string;
  tamil_meaning?: string;
  core_idea?: string;
  memory_trigger?: string;
  visual_scene?: string;
  memory_sentence?: string;
  recall_question?: string;
  natural_domains?: string;
  when_to_use?: string;
  when_not_to_use?: string;
  examples?: string;
  sections?: VocabularyLessonSample["sections"];
}

export interface VocabularyImportResult {
  imported: number;
  items: Array<{ word: any; lesson: any; category: any }>;
  errors: Array<{ row: number; message: string }>;
}

export type VocabularyImportEntry = VocabularyImportRow | VocabularyLessonSample;

const REMOVED_LESSON_SECTIONS = new Set([
  "Word / Phrase",
  "Pronunciation",
  "Word Type",
  "CEFR Level",
  "Frequency",
  "English Meaning",
  "Tamil Meaning",
  "Core Idea",
  "Meaning Layers",
  "Practice + Evaluation",
]);

export function parseVocabularyJson(jsonText: string): VocabularyImportEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid JSON. Please import one vocabulary object or an array of vocabulary objects.");
  }

  if (isDeckJson(parsed)) {
    const deck = asRecord(parsed);
    return (deck.cards as unknown[]).map((card) => normalizeDeckCard(card, deck));
  }

  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Each JSON item must be a vocabulary object.");
    }
    return entry as VocabularyImportEntry;
  });
}

function isDeckJson(value: unknown): value is { cards: unknown[] } {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as Record<string, unknown>).cards)
  );
}

function normalizeDeckCard(card: unknown, deck: Record<string, any>): VocabularyImportEntry {
  const record = asRecord(card);
  const sections = asSectionArray(record.sections);
  const trackCategory = asRecord(sectionContent(sections, "Track & Category", 6));
  const memory = asRecord(sectionContent(sections, "Memory Mastery", 10));
  const meaningLayers = asArray(sectionContent(sections, "Meaning Layers", 11));
  const usageProfile = asArray(sectionContent(sections, "Usage Profile", 12));
  const usageZone = asRecord(sectionContent(sections, "Word Usage Zone", 13));
  const domainRestrictions = asRecord(sectionContent(sections, "Domain Restrictions", 15));
  const patterns = asArray(sectionContent(sections, "Common Patterns / Grammar", 16));
  const story = sectionContent(
    sections,
    "Paragraph-Based Real-Life Conversation / Story",
    17
  );
  const mistakes = asArray(sectionContent(sections, "Common Mistakes", 18));
  const tamilNotes = sectionContent(sections, "Tamil Usage Notes", 19);
  const practiceEvaluation = asRecord(sectionContent(sections, "Practice + Evaluation", 20));
  const deckCategory = asString(deck.category);
  const cardCategory = asString(trackCategory.category);
  const cardTrack = asString(trackCategory.track);

  return {
    track: cardTrack,
    category: cardCategory || deckCategory,
    _categoryCandidates: [
      cardCategory,
      deckCategory,
      cardTrack,
      asString(deck.deck_name),
    ].filter(Boolean),
    word: asString(record.word || sectionContent(sections, "Word / Phrase", 1)).trim(),
    pronunciation: asString(record.pronunciation ?? sectionContent(sections, "Pronunciation", 2)),
    word_type: asString(record.word_type ?? sectionContent(sections, "Word Type", 3)),
    cefr_level: asString(record.cefr_level ?? sectionContent(sections, "CEFR Level", 4)),
    frequency: asString(record.frequency ?? sectionContent(sections, "Frequency", 5)),
    english_meaning: asString(record.english_meaning ?? sectionContent(sections, "English Meaning", 7)),
    tamil_meaning: asString(record.tamil_meaning ?? sectionContent(sections, "Tamil Meaning", 8)),
    core_idea: asString(record.core_idea ?? sectionContent(sections, "Core Idea", 9)),
    memory_mastery: {
      memory_trigger: asString(memory.memory_trigger),
      visual_scene: asString(memory.visual_scene),
      sound_association: "",
      tamil_connection: asString(memory.tamil_connection),
      emotional_hook: "",
      memory_sentence: asString(memory.memory_sentence),
      recall_question: asString(memory.recall_question),
      pattern_family: "",
      notice: "",
    },
    meaning_expansion: {
      layer_1_literal: meaningLayerText(meaningLayers, "Literal"),
      layer_2_abstract: meaningLayerText(meaningLayers, "Abstract"),
      layer_3_figurative: meaningLayerText(meaningLayers, "Figurative"),
      layer_4_professional_technical: meaningLayerText(
        meaningLayers,
        "Professional"
      ),
    },
    usage_mastery: {
      usage_profile: usageProfile,
      word_usage_zone: usageZone,
      natural_domains: asStringArray(sectionContent(sections, "Natural Domains", 14)),
      domain_restrictions: domainRestrictions,
      context_switching_test: [],
      word_nature: "",
      word_nature_reason: "",
      register: "",
      common_contexts: asStringArray(sectionContent(sections, "Natural Domains", 14)),
      tamil_usage_notes: stringifyContent(tamilNotes),
      when_to_use: asStringArray(domainRestrictions.commonly_used),
      when_not_to_use: asStringArray(domainRestrictions.not_normally_used),
    },
    application: {
      examples: examplesFromUsageProfile(usageProfile),
      collocations: {
        strong: patterns.map((item) => asString(asRecord(item).pattern)).filter(Boolean),
        acceptable: [],
        unnatural: [],
        explanation: "",
      },
      native_usage_patterns: patterns.map((item) => {
        const pattern = asString(asRecord(item).pattern);
        const example = asString(asRecord(item).example);
        return example ? `${pattern}: ${example}` : pattern;
      }).filter(Boolean),
      common_mistakes: mistakes,
      confusion_zone: "",
      alternatives_synonyms: {
        near_synonyms: [],
        formal_alternatives: [],
        informal_alternatives: [],
        stronger_c1_c2_alternatives: [],
        nuance: "",
      },
      frequency_by_context: [],
    },
    mastery: {
      mini_conversation: asString(story),
      learn_the_pattern: patterns.map((item) => {
        const pattern = asString(asRecord(item).pattern);
        const example = asString(asRecord(item).example);
        return example ? `${pattern}: ${example}` : pattern;
      }).filter(Boolean),
      guided_practice: asArray(practiceEvaluation.practice).map((item) => {
        const practice = asRecord(item);
        const question = asString(practice.question);
        const answer = asString(practice.answer);
        return answer ? `${question} ${answer}` : question;
      }).filter(Boolean),
      evaluation: asStringArray(practiceEvaluation.evaluation),
      feedback: "",
      mastery_notes: asString(practiceEvaluation.mastery_check),
      native_thinking_model: "",
    },
    sections,
  } as VocabularyImportEntry;
}

type VocabularyLessonSections = NonNullable<VocabularyLessonSample["sections"]>;

function asSectionArray(value: unknown): VocabularyLessonSections {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      const rawNumber = Number(record.number ?? record.section ?? index + 1);
      const number = Number.isFinite(rawNumber) ? rawNumber : index + 1;
      const title = asString(record.title ?? record.name) || `Section ${number}`;
      const content = Object.prototype.hasOwnProperty.call(record, "content")
        ? record.content
        : "";

      return {
        number,
        title,
        content: normalizeSectionContent(content),
      };
    })
    .filter((section) => !REMOVED_LESSON_SECTIONS.has(section.title))
    .map((section, index) => ({ ...section, number: index + 1 }));
}

function normalizeSectionContent(
  content: unknown
): string | string[] | Record<string, unknown> | Array<Record<string, unknown>> {
  if (Array.isArray(content)) {
    if (content.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      return content as Array<Record<string, unknown>>;
    }
    return content.map((item) => asString(item));
  }

  if (content && typeof content === "object") {
    return content as Record<string, unknown>;
  }

  return asString(content);
}

function sectionContent(
  sections: VocabularyLessonSections,
  title: string,
  number: number
) {
  const section = sections?.find(
    (item) => item.title === title
  );
  return section?.content ?? "";
}

function meaningLayerText(layers: unknown[], layerName: string) {
  const layer = layers.find((item) =>
    asString(asRecord(item).layer).toLowerCase().includes(layerName.toLowerCase())
  );
  const record = asRecord(layer);
  const meaning = asString(record.meaning);
  const example = asString(record.example);
  return example ? `${meaning}\nExample: ${example}` : meaning;
}

function examplesFromUsageProfile(profile: unknown[]) {
  return profile.reduce<Record<string, string>>((result, item) => {
    const record = asRecord(item);
    const area = asString(record.usage_area);
    const example = asString(record.example ?? record.example_sentence);
    if (area && example && !result[area]) result[area] = example;
    return result;
  }, {});
}

function splitList(value?: string | string[]) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim());
  return (value || "")
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function cleanFrequency(value?: string): "High" | "Medium" | "Low" {
  return value === "High" || value === "Medium" || value === "Low"
    ? value
    : "Medium";
}

export function buildImportedLesson(
  row: VocabularyImportEntry
): VocabularyLessonSample {
  const input = row as Record<string, any>;
  const memory = asRecord(input.memory_mastery);
  const meaning = asRecord(input.meaning_expansion);
  const usage = asRecord(input.usage_mastery);
  const application = asRecord(input.application);
  const mastery = asRecord(input.mastery);
  const examples = asRecord(application.examples);
  const collocations = asRecord(application.collocations);
  const alternatives = asRecord(application.alternatives_synonyms);
  const word = asString(input.word).trim();
  const englishMeaning = asString(input.english_meaning).trim();
  const naturalDomains = splitList(input.natural_domains ?? usage.natural_domains);
  const whenToUse = splitList(input.when_to_use ?? usage.when_to_use);
  const whenNotToUse = splitList(input.when_not_to_use ?? usage.when_not_to_use);
  const exampleList = splitList(input.examples);

  const lesson: VocabularyLessonSample = {
    track: asString(input.track),
    category: asString(input.category),
    word,
    pronunciation: asString(input.pronunciation),
    word_type: asString(input.word_type),
    cefr_level: asString(input.cefr_level),
    frequency: cleanFrequency(asString(input.frequency)),
    english_meaning: englishMeaning,
    tamil_meaning: asString(input.tamil_meaning),
    core_idea: asString(input.core_idea),
    memory_mastery: {
      memory_trigger: asString(input.memory_trigger ?? memory.memory_trigger),
      visual_scene: asString(input.visual_scene ?? memory.visual_scene),
      sound_association: asString(memory.sound_association),
      tamil_connection: asString(memory.tamil_connection),
      emotional_hook: asString(memory.emotional_hook),
      memory_sentence: asString(input.memory_sentence ?? memory.memory_sentence),
      recall_question: asString(input.recall_question ?? memory.recall_question),
      pattern_family: asString(memory.pattern_family),
      notice: asString(memory.notice),
    },
    meaning_expansion: {
      layer_1_literal: asString(meaning.layer_1_literal),
      layer_2_abstract: asString(meaning.layer_2_abstract),
      layer_3_figurative: asString(meaning.layer_3_figurative),
      layer_4_professional_technical: asString(
        meaning.layer_4_professional_technical
      ),
    },
    usage_mastery: {
      usage_profile: asUsageProfile(usage.usage_profile),
      word_usage_zone: {
        natural_zones: asStringArray(asRecord(usage.word_usage_zone).natural_zones),
        limited_zones: asStringArray(asRecord(usage.word_usage_zone).limited_zones),
        unnatural_zones: asStringArray(
          asRecord(usage.word_usage_zone).unnatural_zones
        ),
        short_explanation: asString(asRecord(usage.word_usage_zone).short_explanation),
      },
      natural_domains: naturalDomains,
      domain_restrictions: {
        commonly_used: asStringArray(asRecord(usage.domain_restrictions).commonly_used),
        rarely_used: asStringArray(asRecord(usage.domain_restrictions).rarely_used),
        not_normally_used: asStringArray(
          asRecord(usage.domain_restrictions).not_normally_used
        ),
        unnatural_example: asString(
          asRecord(usage.domain_restrictions).unnatural_example
        ),
        natural_alternative: asString(
          asRecord(usage.domain_restrictions).natural_alternative
        ),
        explanation: asString(asRecord(usage.domain_restrictions).explanation),
      },
      context_switching_test: asContextSwitchingTest(usage.context_switching_test),
      word_nature: asString(usage.word_nature),
      word_nature_reason: asString(usage.word_nature_reason),
      register: asString(usage.register),
      common_contexts: asStringArray(usage.common_contexts),
      tamil_usage_notes: asString(usage.tamil_usage_notes),
      when_to_use: whenToUse,
      when_not_to_use: whenNotToUse,
    },
    application: {
      examples: {
        ...stringRecord(examples),
        ...(exampleList.length
          ? {
              Everyday: exampleList[0] || "",
              Workplace: exampleList[1] || "",
              Academic: exampleList[2] || "",
            }
          : {}),
      },
      collocations: {
        strong: asStringArray(collocations.strong),
        acceptable: asStringArray(collocations.acceptable),
        unnatural: asStringArray(collocations.unnatural),
        explanation: asString(collocations.explanation),
      },
      native_usage_patterns: asStringArray(application.native_usage_patterns),
      common_mistakes: asCommonMistakes(application.common_mistakes),
      confusion_zone: asString(application.confusion_zone),
      alternatives_synonyms: {
        near_synonyms: asStringArray(alternatives.near_synonyms),
        formal_alternatives: asStringArray(alternatives.formal_alternatives),
        informal_alternatives: asStringArray(alternatives.informal_alternatives),
        stronger_c1_c2_alternatives: asStringArray(
          alternatives.stronger_c1_c2_alternatives
        ),
        nuance: asString(alternatives.nuance),
      },
      frequency_by_context: asFrequencyByContext(application.frequency_by_context),
    },
    mastery: {
      mini_conversation: asString(mastery.mini_conversation),
      learn_the_pattern: asStringArray(mastery.learn_the_pattern),
      guided_practice: asStringArray(mastery.guided_practice),
      evaluation: asStringArray(mastery.evaluation),
      feedback: asString(mastery.feedback),
      mastery_notes: asString(mastery.mastery_notes),
      native_thinking_model: asString(mastery.native_thinking_model),
    },
  };

  const providedSections = asSectionArray(input.sections);
  lesson.sections = providedSections.length
    ? providedSections
    : VOCABULARY_SECTION_TEMPLATE.map((title, index) => ({
        number: index + 1,
        title,
        content: buildSectionContent(title, lesson),
      }));

  return lesson;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "object") return stringifyContent(value);
  return String(value);
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.map((item) => stringifyContent(item)).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = stringifyContent(item);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => asString(item));
  if (typeof value === "string") return splitList(value);
  return [];
}

function stringRecord(value: Record<string, any>): Record<string, string> {
  return Object.entries(value).reduce<Record<string, string>>((result, [key, item]) => {
    result[key] = asString(item);
    return result;
  }, {});
}

function asUsageProfile(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    return {
      usage_area: asString(record.usage_area),
      status: toUsageStatus(record.status),
      example_sentence: asString(record.example_sentence ?? record.example),
      note: asString(record.note),
    };
  });
}

function asContextSwitchingTest(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    return {
      context: asString(record.context),
      natural: toUsageStatus(record.natural),
      example: asString(record.example),
    };
  });
}

function asCommonMistakes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    return {
      incorrect: asString(record.incorrect ?? record.wrong),
      correct: asString(record.correct),
      explanation: asString(record.explanation ?? record.reason),
    };
  });
}

function asFrequencyByContext(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    return {
      context: asString(record.context),
      frequency: cleanFrequency(asString(record.frequency)) as Frequency,
    };
  });
}

function toUsageStatus(value: unknown): "Yes" | "No" | "Limited" {
  return value === "Yes" || value === "No" || value === "Limited"
    ? value
    : "Limited";
}

function findSectionContent(
  sections: any[],
  title: string,
  number: number
): string | string[] | Record<string, unknown> | Array<Record<string, unknown>> | undefined {
  const section = sections.find((item) => {
    const record = asRecord(item);
    return record.title === title || record.number === number;
  });

  if (!section || !Object.prototype.hasOwnProperty.call(section, "content")) {
    return undefined;
  }

  return section.content;
}

function buildSectionContent(title: string, lesson: VocabularyLessonSample) {
  switch (title) {
    case "Basic Information":
      return {
        Word: lesson.word,
        Pronunciation: lesson.pronunciation,
        "Word Type": lesson.word_type,
        "CEFR Level": lesson.cefr_level,
        Frequency: lesson.frequency,
      };
    case "Meaning":
      return {
        English: lesson.english_meaning,
        Tamil: lesson.tamil_meaning,
        "Core Idea": lesson.core_idea,
      };
    case "Memory Mastery":
      return lesson.memory_mastery;
    case "Meaning Expansion":
      return lesson.meaning_expansion;
    case "Usage Mastery":
      return lesson.usage_mastery.usage_profile;
    case "Word Usage Zone":
      return lesson.usage_mastery.word_usage_zone;
    case "Natural Domains":
      return lesson.usage_mastery.natural_domains;
    case "Domain Restrictions":
      return lesson.usage_mastery.domain_restrictions;
    case "Context Switching Test":
      return lesson.usage_mastery.context_switching_test;
    case "Word Nature":
      return {
        Classification: lesson.usage_mastery.word_nature,
        Reason: lesson.usage_mastery.word_nature_reason,
      };
    case "Register":
      return lesson.usage_mastery.register;
    case "Common Contexts":
      return lesson.usage_mastery.common_contexts;
    case "Tamil Usage Notes":
      return lesson.usage_mastery.tamil_usage_notes;
    case "When To Use":
      return lesson.usage_mastery.when_to_use;
    case "When NOT To Use":
      return lesson.usage_mastery.when_not_to_use;
    case "Application":
      return lesson.application.examples;
    case "Collocations":
      return lesson.application.collocations;
    case "Native Usage Patterns":
      return lesson.application.native_usage_patterns;
    case "Common Mistakes":
      return lesson.application.common_mistakes;
    case "Confusion Zone":
      return lesson.application.confusion_zone;
    case "Alternatives & Synonyms":
      return lesson.application.alternatives_synonyms;
    case "Frequency By Context":
      return lesson.application.frequency_by_context;
    case "Mini Conversation":
      return lesson.mastery.mini_conversation;
    case "Learn The Pattern":
      return lesson.mastery.learn_the_pattern;
    case "Guided Practice":
      return lesson.mastery.guided_practice;
    case "Evaluation":
      return lesson.mastery.evaluation;
    case "Feedback":
      return lesson.mastery.feedback;
    case "Mastery Notes":
      return lesson.mastery.mastery_notes;
    case "Native Thinking Model":
      return lesson.mastery.native_thinking_model;
    default:
      return "";
  }
}

export class VocabularyImportService {
  constructor(private db: Knex) {}

  async importSingle(
    row: VocabularyImportRow,
    userId?: string
  ): Promise<VocabularyImportResult> {
    return this.importRows([row], userId);
  }

  async importJson(
    jsonText: string,
    userId?: string
  ): Promise<VocabularyImportResult> {
    return this.importRows(parseVocabularyJson(jsonText), userId);
  }

  async importRows(
    rows: VocabularyImportEntry[],
    userId?: string
  ): Promise<VocabularyImportResult> {
    const items: VocabularyImportResult["items"] = [];
    const errors: VocabularyImportResult["errors"] = [];

    for (const [index, row] of rows.entries()) {
      try {
        validateRow(row);
        const lesson = buildImportedLesson(row);
        items.push(
          await this.saveLesson(
            lesson,
            (row as VocabularyImportRow).categoryId,
            userId,
            (row as VocabularyImportRow)._categoryCandidates
          )
        );
      } catch (error: any) {
        errors.push({
          row: index + 1,
          message:
            error?.message ||
            error?.code ||
            error?.name ||
            "Could not import this row.",
        });
      }
    }

    return { imported: items.length, items, errors };
  }

  private async saveLesson(
    lesson: VocabularyLessonSample,
    categoryId?: string,
    userId?: string,
    categoryCandidates: string[] = []
  ) {
    return this.db.transaction(async (trx) => {
      const category = await resolveCategory(
        trx,
        lesson,
        categoryId,
        categoryCandidates
      );

      const existingWord = await trx("vocabulary_words")
        .where({ category_id: category.id, word: lesson.word })
        .first();

      const wordPayload = {
        category_id: category.id,
        word: lesson.word,
        pronunciation: lesson.pronunciation,
        word_type: lesson.word_type,
        cefr_level: lesson.cefr_level,
        frequency: lesson.frequency,
        english_meaning: lesson.english_meaning,
        tamil_meaning: lesson.tamil_meaning,
        core_idea: lesson.core_idea,
        updated_at: new Date(),
      };

      const [word] = existingWord
        ? await trx("vocabulary_words")
            .where("id", existingWord.id)
            .update(wordPayload)
            .returning("*")
        : await trx("vocabulary_words")
            .insert({ ...wordPayload, created_at: new Date() })
            .returning("*");

      const lessonPayload = buildLessonPayload(word.id, lesson);
      const [savedLesson] = await trx("vocabulary_lessons")
        .insert({ ...lessonPayload, created_at: new Date() })
        .onConflict("word_id")
        .merge(lessonPayload)
        .returning("*");

      if (userId) {
        const [progress] = await trx("user_progress")
          .insert({
            user_id: userId,
            word_id: word.id,
            category_id: category.id,
            status: "not_started",
            proficiency_level: 0,
            times_reviewed: 0,
            next_review_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          })
          .onConflict(["user_id", "word_id"])
          .merge({
            category_id: category.id,
            updated_at: new Date(),
          })
          .returning("*");

        await trx("flashcard_queue")
          .insert({
            user_id: userId,
            word_id: word.id,
            progress_id: progress.id,
            queue_position: 0,
            due_at: progress.next_review_at || new Date(),
            card_type: "vocabulary",
            created_at: new Date(),
            updated_at: new Date(),
          })
          .onConflict(["user_id", "word_id"])
          .merge({
            progress_id: progress.id,
            due_at: progress.next_review_at || new Date(),
            updated_at: new Date(),
          });
      }

      return { word, lesson: savedLesson, category };
    });
  }
}

async function resolveCategory(
  trx: Knex.Transaction,
  lesson: VocabularyLessonSample,
  categoryId?: string,
  categoryCandidates: string[] = []
) {
  if (categoryId) {
    const explicit = await trx("vocabulary_categories").where("id", categoryId).first();
    if (explicit) return explicit;
  }

  const categories = await trx("vocabulary_categories")
    .select("*")
    .orderBy([{ column: "track_number" }, { column: "category_number" }]);

  return selectBestCategory(categories, lesson, categoryCandidates);
}

export function selectBestCategory(
  categories: any[],
  lesson: Pick<VocabularyLessonSample, "category" | "track">,
  categoryCandidates: string[] = []
) {
  if (!categories.length) {
    throw new Error("No vocabulary categories are available.");
  }

  const candidates = uniqueStrings([
    lesson.category,
    ...categoryCandidates,
    lesson.track,
  ]);

  for (const candidate of candidates) {
    const exact = categories.find(
      (category: any) =>
        normalizeName(category.category_name) === normalizeName(candidate)
    );
    if (exact) return exact;
  }

  let best = categories[0];
  let bestScore = 0;
  for (const candidate of candidates) {
    for (const category of categories) {
      const score = categoryMatchScore(candidate, category);
      if (score > bestScore) {
        best = category;
        bestScore = score;
      }
    }
  }

  return best;
}

function categoryMatchScore(candidate: string, category: any) {
  const candidateName = normalizeName(candidate);
  const categoryName = normalizeName(category.category_name);
  const trackName = normalizeName(category.track_name);

  if (!candidateName) return 0;
  if (candidateName === categoryName) return 100;
  if (candidateName === trackName) return 85;
  if (categoryName.includes(candidateName) || candidateName.includes(categoryName)) {
    return 80;
  }

  return tokenOverlap(candidateName, categoryName) * 70 +
    tokenOverlap(candidateName, trackName) * 20;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.length > 3 && part.endsWith("s") ? part.slice(0, -1) : part))
    .join(" ");
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (!leftTokens.length || !rightTokens.size) return 0;

  const matches = leftTokens.filter((token) => rightTokens.has(token)).length;
  return matches / leftTokens.length;
}

function uniqueStrings(values: Array<string | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => asString(value).trim())
    .filter((value) => {
      if (!value) return false;
      const key = normalizeName(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function validateRow(row: VocabularyImportEntry) {
  if (!row.word?.trim()) throw new Error("Word is required.");
  if (!row.english_meaning?.trim()) {
    throw new Error(`English meaning is required for "${row.word}".`);
  }
}

function buildLessonPayload(wordId: string, lesson: VocabularyLessonSample) {
  return {
    word_id: wordId,
    memory_trigger: lesson.memory_mastery.memory_trigger,
    visual_scene: lesson.memory_mastery.visual_scene,
    sound_association: lesson.memory_mastery.sound_association,
    tamil_connection: lesson.memory_mastery.tamil_connection,
    emotional_hook: lesson.memory_mastery.emotional_hook,
    memory_sentence: lesson.memory_mastery.memory_sentence,
    recall_question: lesson.memory_mastery.recall_question,
    pattern_family: lesson.memory_mastery.pattern_family,
    meaning_layer_1_literal: JSON.stringify({
      text: lesson.meaning_expansion.layer_1_literal,
    }),
    meaning_layer_2_abstract: JSON.stringify({
      text: lesson.meaning_expansion.layer_2_abstract,
    }),
    meaning_layer_3_figurative: JSON.stringify({
      text: lesson.meaning_expansion.layer_3_figurative,
    }),
    meaning_layer_4_professional: JSON.stringify({
      text: lesson.meaning_expansion.layer_4_professional_technical,
    }),
    usage_profile: JSON.stringify(lesson.usage_mastery.usage_profile),
    word_usage_zones: JSON.stringify(lesson.usage_mastery.word_usage_zone),
    natural_domains: lesson.usage_mastery.natural_domains,
    domain_restrictions: JSON.stringify(lesson.usage_mastery.domain_restrictions),
    context_switching_test: JSON.stringify(
      lesson.usage_mastery.context_switching_test
    ),
    word_nature: lesson.usage_mastery.word_nature,
    register: lesson.usage_mastery.register,
    common_contexts: lesson.usage_mastery.common_contexts,
    tamil_usage_notes: lesson.usage_mastery.tamil_usage_notes,
    examples: JSON.stringify(lesson.application.examples),
    collocations: JSON.stringify(lesson.application.collocations),
    native_usage_patterns: lesson.application.native_usage_patterns.join("\n"),
    common_mistakes: JSON.stringify(lesson.application.common_mistakes),
    confusion_zone: lesson.application.confusion_zone,
    alternatives_synonyms: JSON.stringify(lesson.application.alternatives_synonyms),
    frequency_by_context: JSON.stringify(lesson.application.frequency_by_context),
    mini_conversation: lesson.mastery.mini_conversation,
    learn_pattern: lesson.mastery.learn_the_pattern.join("\n"),
    guided_practice: JSON.stringify(lesson.mastery.guided_practice),
    evaluation: JSON.stringify(lesson.mastery.evaluation),
    feedback_template: lesson.mastery.feedback,
    mastery_notes: lesson.mastery.mastery_notes,
    native_thinking_model: lesson.mastery.native_thinking_model,
    lesson_data: JSON.stringify(lesson),
    updated_at: new Date(),
  };
}
