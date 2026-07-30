import { z } from "zod";

export const VOCABULARY_LESSON_FORMAT_VERSION = "simplified-v2" as const;

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

  if (normalizedValue.includes(normalizedTerm)) return true;

  const valueWords = new Set(normalizedValue.split(" "));
  const meaningfulWords = normalizedTerm
    .split(" ")
    .filter((word) => word.length >= 4);
  const irregularForms: Record<string, string[]> = {
    come: ["came", "comes", "coming"],
  };
  const formsFor = (word: string) => [
    word,
    `${word}s`,
    word.endsWith("e") ? `${word}d` : `${word}ed`,
    word.endsWith("e") ? `${word.slice(0, -1)}ing` : `${word}ing`,
    ...(irregularForms[word] || []),
  ];
  return (
    meaningfulWords.length > 0 &&
    meaningfulWords.every((word) =>
      formsFor(word).some((form) => valueWords.has(form)),
    )
  );
}

export function vocabularyLessonQualityIssues(
  value: unknown,
  term: string,
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
      "lesson.meaning_in_context.source_sentence",
      lesson.meaning_in_context.source_sentence,
    ],
    [
      "lesson.patterns_collocations.main_pattern",
      lesson.patterns_collocations.main_pattern,
    ],
    [
      "lesson.memory_practice.memory_sentence",
      lesson.memory_practice.memory_sentence,
    ],
  ];

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
    !includesTerm(
      `${lesson.mistakes_differences.common_mistake} ${lesson.mistakes_differences.correction}`,
      term,
    )
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

export function assertVocabularyLessonCompliant(
  value: unknown,
  term: string,
): VocabularyLesson {
  const issues = vocabularyLessonQualityIssues(value, term);
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
