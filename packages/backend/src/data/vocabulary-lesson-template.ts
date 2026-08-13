import { z } from "zod";

export const VOCABULARY_LESSON_FORMAT_VERSION = "simplified-v2" as const;
export const VOCABULARY_VALIDATOR_POLICY_VERSION =
  "expression-grammar-2026.3" as const;

export const VOCABULARY_SECTION_TEMPLATE = [
  "Overview",
  "Meaning in Context",
  "Usage Guide",
  "Patterns & Collocations",
  "Natural Examples",
  "Mistakes & Differences",
  "Memory & Practice",
  "Advanced Nuance",
] as const;

const usefulText = z.string().trim().min(8, "must contain useful content");
const usefulTextList = z.array(usefulText).min(1, "must not be empty");

export const VocabularyLessonSchema = z
  .object({
    format_version: z.literal(VOCABULARY_LESSON_FORMAT_VERSION),
    sample_version: z.number().int().positive().optional(),
    sample_notice: usefulText.optional(),
    overview: z
      .object({
        meaning_usage_profile: z
          .object({
            meaning_type: usefulText,
            connotation: usefulText,
            tone: usefulText,
            register: usefulText,
          })
          .strict(),
      })
      .strict(),
    meaning_in_context: z
      .object({
        source_sentence: usefulText,
        contextual_meaning: usefulText,
        simple_explanation: usefulText,
      })
      .strict(),
    usage_guide: z
      .object({
        when_to_use: usefulTextList,
        when_not_to_use: usefulTextList,
      })
      .strict(),
    patterns_collocations: z
      .object({
        main_pattern: usefulText,
        common_collocations: z
          .array(usefulText)
          .min(2, "must contain at least two useful collocations"),
      })
      .strict(),
    natural_examples: z
      .object({
        examples: z
          .record(usefulText)
          .refine(
            (examples) => Object.keys(examples).length >= 2,
            "must contain at least two natural examples",
          ),
        mini_conversation: usefulText,
      })
      .strict(),
    mistakes_differences: z
      .object({
        common_mistake: usefulText,
        correction: usefulText,
        important_difference: usefulText,
      })
      .strict(),
    memory_practice: z
      .object({
        memory_trigger: usefulText,
        memory_sentence: usefulText,
        recall_question: usefulText,
        recognition_task: usefulText,
        production_task: usefulText,
      })
      .strict(),
    advanced_nuance: usefulTextList,
  })
  .strict();

export type VocabularyLesson = z.infer<typeof VocabularyLessonSchema>;

export const VOCABULARY_ENTRY_RESPONSE_SCHEMA = {
  type: "OBJECT",
  required: ["word", "pronunciation", "wordType", "englishMeaning", "tamilMeaning", "coreIdea", "format_version", "overview", "meaning_in_context", "usage_guide", "patterns_collocations", "natural_examples", "mistakes_differences", "memory_practice", "advanced_nuance"],
  properties: {
    word: { type: "STRING" }, pronunciation: { type: "STRING" },
    wordType: { type: "STRING" }, englishMeaning: { type: "STRING" },
    tamilMeaning: { type: "STRING" }, coreIdea: { type: "STRING" },
    format_version: { type: "STRING", enum: [VOCABULARY_LESSON_FORMAT_VERSION] },
    overview: { type: "OBJECT", required: ["meaning_usage_profile"], properties: {
      meaning_usage_profile: { type: "OBJECT", required: ["meaning_type", "connotation", "tone", "register"], properties: {
        meaning_type: { type: "STRING" }, connotation: { type: "STRING" },
        tone: { type: "STRING" }, register: { type: "STRING" },
      }},
    }},
    meaning_in_context: { type: "OBJECT", required: ["source_sentence", "contextual_meaning", "simple_explanation"], properties: {
      source_sentence: { type: "STRING" }, contextual_meaning: { type: "STRING" },
      simple_explanation: { type: "STRING" },
    }},
    usage_guide: { type: "OBJECT", required: ["when_to_use", "when_not_to_use"], properties: {
      when_to_use: { type: "ARRAY", items: { type: "STRING" } },
      when_not_to_use: { type: "ARRAY", items: { type: "STRING" } },
    }},
    patterns_collocations: { type: "OBJECT", required: ["main_pattern", "common_collocations"], properties: {
      main_pattern: { type: "STRING" },
      common_collocations: { type: "ARRAY", items: { type: "STRING" } },
    }},
    natural_examples: { type: "OBJECT", required: ["examples", "mini_conversation"], properties: {
      examples: { type: "OBJECT", additionalProperties: { type: "STRING" } },
      mini_conversation: { type: "STRING" },
    }},
    mistakes_differences: { type: "OBJECT", required: ["common_mistake", "correction", "important_difference"], properties: {
      common_mistake: { type: "STRING" }, correction: { type: "STRING" },
      important_difference: { type: "STRING" },
    }},
    memory_practice: { type: "OBJECT", required: ["memory_trigger", "memory_sentence", "recall_question", "recognition_task", "production_task"], properties: {
      memory_trigger: { type: "STRING" }, memory_sentence: { type: "STRING" },
      recall_question: { type: "STRING" }, recognition_task: { type: "STRING" },
      production_task: { type: "STRING" },
    }},
    advanced_nuance: { type: "ARRAY", items: { type: "STRING" } },
  },
} as const;

export interface VocabularyEntryQualityContext {
  term: string;
  contextualMeaning: string;
  sourceSentence: string;
}

export interface GeneratedVocabularyEntryLike {
  word?: unknown;
  pronunciation?: unknown;
  wordType?: unknown;
  englishMeaning?: unknown;
  tamilMeaning?: unknown;
  coreIdea?: unknown;
  lesson?: unknown;
}

const FORBIDDEN_FILLER_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:todo|tbd|placeholder|lorem ipsum|coming soon)\b/i, "placeholder text"],
  [
    /\b(?:not added|not set|none provided|no information|details unavailable)\b/i,
    "missing-content text",
  ],
  [
    /\b(?:add|insert|write|fill in)\s+(?:content|text|details|later)\b/i,
    "authoring instruction",
  ],
  [
    /\b(?:use it when appropriate|use it as needed|depends on the context)\b/i,
    "vague usage advice",
  ],
  [
    /\b(?:useful word|common word|many situations|various contexts)\b/i,
    "generic learning content",
  ],
];

function normalizeForMatch(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

const IRREGULAR_VERB_GROUPS = [
  ["be", "am", "is", "are", "was", "were", "been", "being"],
  ["become", "became", "becomes", "becoming"],
  ["begin", "began", "begun", "begins", "beginning"],
  ["break", "broke", "broken", "breaks", "breaking"],
  ["bring", "brought", "brings", "bringing"],
  ["build", "built", "builds", "building"],
  ["buy", "bought", "buys", "buying"],
  ["catch", "caught", "catches", "catching"],
  ["choose", "chose", "chosen", "chooses", "choosing"],
  ["come", "came", "comes", "coming"],
  ["do", "did", "done", "does", "doing"],
  ["draw", "drew", "drawn", "draws", "drawing"],
  ["drink", "drank", "drunk", "drinks", "drinking"],
  ["drive", "drove", "driven", "drives", "driving"],
  ["eat", "ate", "eaten", "eats", "eating"],
  ["fall", "fell", "fallen", "falls", "falling"],
  ["feel", "felt", "feels", "feeling"],
  ["find", "found", "finds", "finding"],
  ["get", "got", "gotten", "gets", "getting"],
  ["give", "gave", "given", "gives", "giving"],
  ["go", "went", "gone", "goes", "going"],
  ["grow", "grew", "grown", "grows", "growing"],
  ["have", "had", "has", "having"],
  ["hear", "heard", "hears", "hearing"],
  ["hold", "held", "holds", "holding"],
  ["keep", "kept", "keeps", "keeping"],
  ["know", "knew", "known", "knows", "knowing"],
  ["leave", "left", "leaves", "leaving"],
  ["lose", "lost", "loses", "losing"],
  ["make", "made", "makes", "making"],
  ["meet", "met", "meets", "meeting"],
  ["pay", "paid", "pays", "paying"],
  ["read", "reads", "reading"],
  ["run", "ran", "runs", "running"],
  ["say", "said", "says", "saying"],
  ["see", "saw", "seen", "sees", "seeing"],
  ["send", "sent", "sends", "sending"],
  ["set", "sets", "setting"],
  ["show", "showed", "shown", "shows", "showing"],
  ["speak", "spoke", "spoken", "speaks", "speaking"],
  ["stand", "stood", "stands", "standing"],
  ["take", "took", "taken", "takes", "taking"],
  ["teach", "taught", "teaches", "teaching"],
  ["tell", "told", "tells", "telling"],
  ["think", "thought", "thinks", "thinking"],
  ["throw", "threw", "thrown", "throws", "throwing"],
  ["understand", "understood", "understands", "understanding"],
  ["wear", "wore", "worn", "wears", "wearing"],
  ["win", "won", "wins", "winning"],
  ["write", "wrote", "written", "writes", "writing"],
] as const;

const IRREGULAR_FORM_INDEX = new Map<string, ReadonlySet<string>>();
for (const group of IRREGULAR_VERB_GROUPS) {
  const forms = new Set<string>(group);
  for (const form of group) IRREGULAR_FORM_INDEX.set(form, forms);
}

const NON_INFLECTING_EXPRESSION_WORDS = new Set(
  "a an and as at away back by down for from in into of off on out over the through to together up upon with without".split(
    " ",
  ),
);

const EXPRESSION_SLOT_WORDS = new Set([
  "oneself",
  "one's",
  "somebody",
  "somebody's",
  "someone",
  "someone's",
  "something",
  "your",
  "yourself",
]);

const EXPRESSION_SLOT_FORMS = new Set(
  "her hers herself him himself his it itself me mine my myself our ours ourselves somebody somebody's someone someone's something their theirs them themselves us you your yours yourself yourselves".split(
    " ",
  ),
);

const EXPRESSION_SLOT_LEADS = new Set(
  "a an any each her his its my our some that the their these this those your".split(
    " ",
  ),
);

const SEPARABLE_CONTINUATION_WORDS = new Set(
  "about across after against along around at away back before behind by down for from in into like of off on out over through to together up upon with".split(
    " ",
  ),
);

const FORBIDDEN_EXPRESSION_GAP_WORDS = new Set(
  "and but never no nor not or without".split(" "),
);

function regularForms(word: string) {
  const forms = new Set([word]);
  if (word.endsWith("y") && !/[aeiou]y$/.test(word)) {
    forms.add(`${word.slice(0, -1)}ies`);
    forms.add(`${word.slice(0, -1)}ied`);
  } else {
    forms.add(`${word}s`);
    forms.add(`${word}ed`);
  }
  if (/(?:s|x|z|ch|sh)$/.test(word)) forms.add(`${word}es`);
  if (word.endsWith("o")) forms.add(`${word}es`);
  if (word.endsWith("e")) {
    forms.add(`${word}d`);
    forms.add(`${word.slice(0, -1)}ing`);
  } else {
    forms.add(`${word}ing`);
  }
  if (/^[a-z]*[aeiou][^aeiouwxy]$/.test(word)) {
    const finalLetter = word[word.length - 1];
    forms.add(`${word}${finalLetter}ed`);
    forms.add(`${word}${finalLetter}ing`);
  }
  return forms;
}

function isExpressionSlot(word: string) {
  return EXPRESSION_SLOT_WORDS.has(word);
}

function isExpressionSlotForm(word: string) {
  return EXPRESSION_SLOT_FORMS.has(word) || /^[a-z]+'s$/.test(word);
}

function expressionSlotMatches(words: string[]) {
  if (!words.length || words.length > 4) return false;
  if (words.some((word) => FORBIDDEN_EXPRESSION_GAP_WORDS.has(word)))
    return false;
  if (isExpressionSlotForm(words[0])) return true;
  // Reciprocal possessives and bounded noun phrases: each other's nerves,
  // one another's concerns, the manager's decision.
  if (
    words.length === 2 &&
    ((words[0] === "each" && words[1] === "other's") ||
      (words[0] === "one" && words[1] === "another's"))
  )
    return true;
  return words.length > 1 && EXPRESSION_SLOT_LEADS.has(words[0]);
}

function wordMatchesInflection(sourceWord: string, termWord: string) {
  if (sourceWord === termWord) return true;
  if (isExpressionSlot(termWord)) return isExpressionSlotForm(sourceWord);
  if (NON_INFLECTING_EXPRESSION_WORDS.has(termWord)) return false;
  const irregular = IRREGULAR_FORM_INDEX.get(termWord);
  if (irregular?.has(sourceWord)) return true;
  return regularForms(termWord).has(sourceWord);
}

function collectTextLeaves(
  value: unknown,
  path = "lesson",
): Array<{ path: string; value: string }> {
  if (typeof value === "string") return [{ path, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectTextLeaves(item, `${path}[${index}]`),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectTextLeaves(item, `${path}.${key}`),
    );
  }
  return [];
}

function includesTerm(value: string, term: string) {
  const normalizedValue = normalizeForMatch(value);
  const normalizedTerm = normalizeForMatch(term);
  if (!normalizedTerm) return false;

  const valueWords = normalizedValue.split(" ");
  const termWords = normalizedTerm.split(" ");
  if (!termWords.length || termWords.length > valueWords.length) return false;

  const allowsSeparatedObject =
    termWords.length > 1 && SEPARABLE_CONTINUATION_WORDS.has(termWords[1]);

  const matchesFrom = (sourceIndex: number, termIndex: number): boolean => {
    if (termIndex >= termWords.length) return true;
    const termWord = termWords[termIndex];

    if (isExpressionSlot(termWord)) {
      for (let width = 1; width <= 4; width += 1) {
        const slotWords = valueWords.slice(sourceIndex, sourceIndex + width);
        if (
          slotWords.length === width &&
          !slotWords.some((word) => FORBIDDEN_EXPRESSION_GAP_WORDS.has(word)) &&
          expressionSlotMatches(slotWords) &&
          matchesFrom(sourceIndex + width, termIndex + 1)
        ) {
          return true;
        }
      }
      return false;
    }

    if (
      wordMatchesInflection(valueWords[sourceIndex] ?? "", termWord) &&
      matchesFrom(sourceIndex + 1, termIndex + 1)
    ) {
      return true;
    }

    // English separable expressions allow a short object or manner phrase
    // between the head verb and its particle/preposition: bring me into
    // contact with, get us back on track, work that out, steer completely away.
    if (allowsSeparatedObject && termIndex === 1) {
      for (let width = 1; width <= 4; width += 1) {
        const gapWords = valueWords.slice(sourceIndex, sourceIndex + width);
        if (
          gapWords.length === width &&
          !gapWords.some((word) => FORBIDDEN_EXPRESSION_GAP_WORDS.has(word)) &&
          wordMatchesInflection(valueWords[sourceIndex + width] ?? "", termWord) &&
          matchesFrom(sourceIndex + width + 1, termIndex + 1)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  return valueWords.some((_, start) => matchesFrom(start, 0));
}

export function vocabularyExpressionCompatibilityIssues(
  term: string,
): string[] {
  const normalizedTerm = normalizeForMatch(term);
  if (!normalizedTerm) return ["term must contain a matchable expression"];
  if (!includesTerm(normalizedTerm, normalizedTerm)) {
    return ["term cannot be represented by the shared expression matcher"];
  }
  return [];
}

export function vocabularyLessonQualityIssues(
  value: unknown,
  term: string,
  options: { trustedSourceSentence?: string } = {},
): string[] {
  const parsed = VocabularyLessonSchema.safeParse(value);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => {
      const path = issue.path.length
        ? `lesson.${issue.path.join(".")}`
        : "lesson";
      return `${path}: ${issue.message}`;
    });
  }

  const lesson = parsed.data;
  const issues: string[] = [];

  for (const leaf of collectTextLeaves(lesson)) {
    for (const [pattern, label] of FORBIDDEN_FILLER_PATTERNS) {
      if (pattern.test(leaf.value)) {
        issues.push(`${leaf.path}: contains ${label}`);
        break;
      }
    }
  }

  const termSpecificAnchors: Array<[string, string]> = [
    [
      "lesson.patterns_collocations.main_pattern",
      lesson.patterns_collocations.main_pattern,
    ],
    [
      "lesson.memory_practice.memory_sentence",
      lesson.memory_practice.memory_sentence,
    ],
  ];

  if (
    options.trustedSourceSentence !==
      lesson.meaning_in_context.source_sentence &&
    !includesTerm(lesson.meaning_in_context.source_sentence, term)
  ) {
    issues.push(
      `lesson.meaning_in_context.source_sentence: must explicitly demonstrate "${term}"`,
    );
  }

  for (const [path, content] of termSpecificAnchors) {
    if (!includesTerm(content, term)) {
      issues.push(`${path}: must explicitly demonstrate "${term}"`);
    }
  }

  const termSpecificExamples = Object.values(
    lesson.natural_examples.examples,
  ).filter((example) => includesTerm(example, term)).length;
  if (termSpecificExamples < 2) {
    issues.push(
      `lesson.natural_examples.examples: at least two examples must use "${term}"`,
    );
  }

  if (
    !includesTerm(lesson.mistakes_differences.common_mistake, term) &&
    !includesTerm(lesson.mistakes_differences.correction, term)
  ) {
    issues.push(
      `lesson.mistakes_differences: the mistake or correction must explicitly use "${term}"`,
    );
  }

  if (!lesson.advanced_nuance.some((nuance) => includesTerm(nuance, term))) {
    issues.push(
      `lesson.advanced_nuance: at least one nuance must explicitly explain "${term}"`,
    );
  }

  return issues;
}


export function generatedVocabularyEntryQualityIssues(
  entry: GeneratedVocabularyEntryLike,
  expected: VocabularyEntryQualityContext,
): string[] {
  const issues = vocabularyLessonQualityIssues(entry.lesson, expected.term, {
    trustedSourceSentence: expected.sourceSentence,
  });
  const requiredHeaders: Array<[keyof GeneratedVocabularyEntryLike, number]> = [
    ["pronunciation", 2], ["wordType", 2], ["englishMeaning", 8],
    ["tamilMeaning", 2], ["coreIdea", 8],
  ];
  for (const [field, minimum] of requiredHeaders) {
    if (String(entry[field] ?? "").trim().length < minimum) {
      issues.push(String(field) + ": must contain useful content");
    }
  }
  if (String(entry.word ?? "").trim() !== expected.term.trim()) {
    issues.push("word must be the real unsuffixed assessed term");
  }
  if (String(entry.englishMeaning ?? "").trim() !== expected.contextualMeaning.trim()) {
    issues.push("englishMeaning must exactly equal the assessed contextual meaning");
  }
  const lesson = entry.lesson as Partial<VocabularyLesson> | undefined;
  if (lesson?.meaning_in_context?.source_sentence !== expected.sourceSentence) {
    issues.push("source sentence must exactly equal the recorded evidence sentence");
  }
  if (lesson?.meaning_in_context?.contextual_meaning !== expected.contextualMeaning) {
    issues.push("lesson contextual meaning must exactly equal the assessed meaning");
  }
  const tamilMeaning = String(entry.tamilMeaning ?? "").trim();
  if (!/[\u0B80-\u0BFF]/u.test(tamilMeaning)) {
    issues.push("Tamil meaning must contain natural Tamil text");
  }
  if (tamilMeaning && normalizeForMatch(tamilMeaning) === normalizeForMatch(String(entry.englishMeaning ?? ""))) {
    issues.push("Tamil meaning must not repeat the English meaning");
  }
  for (const leaf of collectTextLeaves({
    pronunciation: entry.pronunciation, wordType: entry.wordType,
    englishMeaning: entry.englishMeaning, tamilMeaning: entry.tamilMeaning,
    coreIdea: entry.coreIdea,
  }, "entry")) {
    for (const [pattern, label] of FORBIDDEN_FILLER_PATTERNS) {
      if (pattern.test(leaf.value)) {
        issues.push(leaf.path + ": contains " + label);
        break;
      }
    }
  }
  return [...new Set(issues)];
}

export function assertVocabularyLessonCompliant(
  value: unknown,
  term: string,
  options: { trustedSourceSentence?: string } = {},
): VocabularyLesson {
  const issues = vocabularyLessonQualityIssues(value, term, options);
  if (issues.length) {
    throw new Error(
      `Vocabulary lesson for "${term}" is incomplete or generic:\n- ${issues.join(
        "\n- ",
      )}`,
    );
  }
  return VocabularyLessonSchema.parse(value);
}

export const VOCABULARY_SECTION_TEMPLATE_PROMPT = [
  "Generate exactly these eight complete lesson sections:",
  ...VOCABULARY_SECTION_TEMPLATE.map(
    (title, index) => `${index + 1}. ${title}`,
  ),
  "",
  "Every section is required. Use specific, term-relevant teaching content.",
  "Never use empty values, placeholders, generic advice, or invented filler.",
  "Overview must contain only Meaning type, Connotation, Tone, and Register.",
  "Advanced Nuance must contain a genuine distinction for this term, even for a common word.",
].join("\n");
