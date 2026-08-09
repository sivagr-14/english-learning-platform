import {
  TAXONOMY_SPECIFIC_CATEGORIES,
  taxonomyPathForCategoryKey,
} from "../data/vocabulary-taxonomy";
import {
  VOCABULARY_SECTION_TEMPLATE_PROMPT,
  VOCABULARY_LESSON_FORMAT_VERSION,
  VOCABULARY_ENTRY_RESPONSE_SCHEMA,
  generatedVocabularyEntryQualityIssues,
} from "../data/vocabulary-lesson-template";
import {
  CONTENT_MANIFEST_VERSION,
  CONTENT_BATCH_VERSION,
  ManifestCandidateSchema,
  GeneratedPackEntrySchema,
} from "./content-pack-contract";
import { generateJson } from "./ai-provider.service";
import { logger } from "../utils/logger";
import {
  ExistingVocabularySense,
  normalizeSenseKey,
  resolveContextualSense,
} from "./vocabulary-sense.service";
import {
  classifyProviderFailure,
  ProviderRequestError,
} from "./provider-reliability";

// Sent once per assessment call. Compact on purpose (key + name only, no
// descriptions) to keep the primary-tier prompt cheap even though the full
// catalogue is ~300 entries -- this is a one-time-per-chunk cost, not
// per-word, so it stays a small fraction of overall token spend.
const TAXONOMY_CATALOG_PROMPT = TAXONOMY_SPECIFIC_CATEGORIES.map(
  (category) =>
    `${category.domainKey} -> ${category.usageGroupKey} -> ${category.key} :: ${category.name}`,
).join("\n");

export const GEMINI_CANDIDATE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  required: ["candidates"],
  properties: {
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: [
          "candidateId", "term", "baseForm", "itemType", "contextualMeaning", "senseKey",
          "categoryKey", "taxonomyConfidence",
          "cefrLevel", "usageFrequency", "fluencyValue", "sourceSentence",
          "senseExplanation", "decision",
        ],
        properties: {
          candidateId: { type: "STRING" }, term: { type: "STRING" }, baseForm: { type: "STRING" },
          itemType: { type: "STRING" }, contextualMeaning: { type: "STRING" }, senseKey: { type: "STRING" },
          // Keep the wire schema compact. Sending the full ~300-key catalogue as an
          // enum makes Gemini reject the request with INVALID_ARGUMENT. The prompt
          // constrains selection and normalizeCandidateTaxonomy validates the returned
          // leaf against the authoritative catalogue before any manifest is persisted.
          categoryKey: { type: "STRING" }, taxonomyConfidence: { type: "STRING" },
          taxonomyReason: { type: "STRING" }, cefrLevel: { type: "STRING" }, usageFrequency: { type: "STRING" },
          fluencyValue: { type: "STRING" }, sourceSentence: { type: "STRING" }, senseExplanation: { type: "STRING" },
          decision: { type: "STRING" }, reason: { type: "STRING" },
        },
      },
    },
  },
} as const;

interface RawCandidate {
  candidateId: string;
  term: string;
  baseForm: string;
  itemType: string;
  contextualMeaning: string;
  senseKey: string;
  categoryKey: string;
  domainKey?: string;
  usageGroupKey?: string;
  taxonomyConfidence: "high" | "medium" | "low";
  taxonomyReason?: string;
  cefrLevel: string;
  usageFrequency: "heavy" | "medium";
  fluencyValue: "essential" | "useful" | "specialized";
  sourceSentence: string;
  senseExplanation: string;
  decision: "generate" | "filtered" | "rejected";
  reason?: string;
}

/**
 * Stage 1 (assess): asks the primary-tier model to identify vocabulary
 * worth teaching in a chunk. Deliberately does NOT attempt sense-matching
 * against a learner's existing vocabulary in this pass -- every accepted
 * candidate is treated as senseDecision: "new_sense". Matching against
 * existing senses (the "existing" decision path in the contract) needs a
 * lookup against the user's current vocabulary_words and is a reasonable
 * next increment, not required to prove the pipeline end-to-end.
 */
export async function assessChunk(
  chunkText: string,
  chunkId: string,
  signal?: AbortSignal,
  deterministicCandidates: Array<{
    candidateId: string;
    term: string;
    itemType: string;
  }> = [],
  provider: "gemini" | "ollama" = "gemini",
  timeoutMs?: number,
): Promise<RawCandidate[]> {
  const systemPrompt = `You identify English vocabulary worth teaching an intermediate-to-advanced learner from a passage of text. You only propose words/phrases that are genuinely useful to learn -- not every word in the passage. Skip basic A1 vocabulary a learner already knows (e.g. "the", "go", "happy"). Prefer collocations, phrasal verbs, idioms, and words used in a non-obvious sense over isolated common words.

Return ONLY a JSON object: { "candidates": [ ... ] }. Return exactly one result for every supplied candidate ID; never add, remove, merge or rename IDs. Each candidate:
{
  "candidateId": string (copy the supplied stable ID exactly),
  "term": string (as it appears or its dictionary form),
  "baseForm": string (dictionary/lemma form),
  "itemType": one of "word" | "phrasal verb" | "idiom" | "collocation" | "fixed phrase" | "conversational pattern",
  "contextualMeaning": string (at least 8 characters, explains the meaning AS USED in this passage),
  "senseKey": string (stable semantic identity such as "financial-institution"; never derive it from taxonomy),
  "categoryKey": string (copy exactly one approved leaf key from the hierarchy below; the server derives its Domain and Usage Group),
  "taxonomyConfidence": one of "high" | "medium" | "low",
  "taxonomyReason": string (required when confidence is low),
  "cefrLevel": one of "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
  "usageFrequency": "heavy" | "medium" (never "low" -- if it's low-frequency, omit the candidate entirely),
  "fluencyValue": "essential" | "useful" | "specialized",
  "sourceSentence": string (the exact sentence from the passage containing the term),
  "senseExplanation": string (at least 8 characters, why this sense/usage matters),
  "decision": "generate" | "filtered" | "rejected",
  "reason": string (required for filtered or rejected)
}

Assess the complete bounded inventory. Quality over quantity.

Valid categoryKey values (format "key :: display name"):
${TAXONOMY_CATALOG_PROMPT}`;

  const result = await generateJson<{ candidates: RawCandidate[] }>({
    tier: "primary",
    systemPrompt,
    userPrompt: `Passage (chunkId: ${chunkId}):\n\n${chunkText}\n\nDeterministic inventory (classify every ID):\n${JSON.stringify(deterministicCandidates)}`,
    signal,
    responseSchema: GEMINI_CANDIDATE_RESPONSE_SCHEMA,
    provider,
    timeoutMs,
  });

  const expected = new Set(deterministicCandidates.map((item) => item.candidateId));
  const returned = result.data.candidates || [];
  const returnedIds = returned.map((item) => item.candidateId);
  if (
    returnedIds.length !== expected.size ||
    new Set(returnedIds).size !== returnedIds.length ||
    returnedIds.some((id) => !expected.has(id))
  ) {
    throw new ProviderRequestError(
      "validation_failed",
      `${provider} candidate IDs did not exactly match the deterministic inventory`,
      false,
    );
  }

  const normalized = returned.map(normalizeCandidateTaxonomy);
  for (const candidate of normalized) {
    if (
      candidate.taxonomyConfidence === "low" &&
      !candidate.taxonomyReason?.trim()
    )
      throw new ProviderRequestError(
        "validation_failed",
        `Low-confidence taxonomy requires a reason for candidate ${candidate.candidateId}`,
        false,
      );
  }
  return normalized;
}

/**
 * Providers choose one approved leaf. Parent labels are canonical catalogue
 * data, not independent model output: deriving them here prevents a valid leaf
 * from being rejected because a model copied one parent key incorrectly.
 * Unknown leaves still fail closed before manifest creation or persistence.
 */
export function normalizeCandidateTaxonomy(
  candidate: RawCandidate,
): RawCandidate {
  const path = taxonomyPathForCategoryKey(candidate.categoryKey);
  if (!path) {
    throw new ProviderRequestError(
      "validation_failed",
      `Assessment proposed an invented taxonomy category for candidate ${candidate.candidateId}`,
      false,
    );
  }
  return {
    ...candidate,
    domainKey: path.domainKey,
    usageGroupKey: path.usageGroupKey,
  };
}

/**
 * Builds a schema-valid manifest candidate from a raw assessment result.
 * Fails the assessment if assembly is invalid. Silently dropping a stable
 * deterministic candidate would make completion reconciliation impossible.
 */
export function toManifestCandidate(
  raw: RawCandidate,
  chunkId: string,
  page: number,
  occurrences: Array<{ page: number; chunkId: string; sentence: string }> = [
    { page, chunkId, sentence: raw.sourceSentence },
  ],
) {
  const taxonomyPath = taxonomyPathForCategoryKey(raw.categoryKey)!;
  const candidate = {
    candidateId: `cand-${raw.candidateId.slice(0, 32)}-${normalizeSenseKey(raw.senseKey).slice(0, 80)}`,
    term: raw.term,
    baseForm: raw.baseForm || raw.term,
    itemType: raw.itemType as any,
    decision: raw.decision,
    senseDecision: "new_sense" as const,
    senseKey: raw.senseKey,
    cefrLevel: raw.cefrLevel as any,
    usageFrequency: raw.usageFrequency,
    fluencyValue: raw.fluencyValue,
    categoryName: taxonomyPath.categoryName,
    contextualMeaning: raw.contextualMeaning,
    senseEvidence: {
      sentence: raw.sourceSentence,
      explanation: raw.senseExplanation,
    },
    taxonomy: {
      taxonomyVersion: taxonomyPath.taxonomyVersion,
      domainKey: taxonomyPath.domainKey,
      usageGroupKey: taxonomyPath.usageGroupKey,
      categoryKey: taxonomyPath.categoryKey,
      confidence: raw.taxonomyConfidence,
      ...(raw.taxonomyConfidence === "low"
        ? { reason: raw.taxonomyReason }
        : {}),
    },
    occurrences,
    ...(raw.decision === "generate"
      ? {}
      : { reason: raw.reason || "Provider-neutral policy excluded this candidate." }),
  };

  const validation = ManifestCandidateSchema.safeParse(candidate);
  if (!validation.success) {
    throw new ProviderRequestError(
      "validation_failed",
      `Candidate ${raw.candidateId} failed manifest validation: ${validation.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
      false,
    );
  }
  return validation.data;
}

export function resolveManifestCandidateAgainstExisting(
  candidate: ReturnType<typeof ManifestCandidateSchema.parse>,
  existingSenses: ExistingVocabularySense[],
) {
  if (candidate.decision !== "generate" || !("senseDecision" in candidate))
    return candidate;

  const resolution = resolveContextualSense(
    {
      term: candidate.term,
      contextualMeaning: candidate.contextualMeaning,
      senseKey: candidate.senseKey,
      declaredDecision: candidate.senseDecision,
      matchedWordId: candidate.matchedWordId,
    },
    existingSenses,
  );

  if (resolution.decision === "same_sense") {
    return ManifestCandidateSchema.parse({
      ...candidate,
      decision: "existing",
      senseDecision: "same_sense",
      matchedWordId: resolution.matchedSense.id,
      reason: resolution.reason,
    });
  }
  if (resolution.decision === "ambiguous") {
    return ManifestCandidateSchema.parse({
      ...candidate,
      decision: "rejected",
      senseDecision: "ambiguous",
      reason: resolution.reason,
    });
  }
  return candidate;
}

/**
 * Stage 2 (generate): produces the full 8-section lesson for one approved
 * candidate. Runs on the primary tier first; if the deterministic quality
 * validator (the same one used for the manual ChatGPT-UI flow) rejects the
 * output, retries once on the escalation tier before giving up on that
 * single candidate. This is the actual cost-minimization mechanism
 * discussed earlier: pay for the strong model only on the entries that
 * need it, not on the whole batch.
 */
export async function generateLessonEntry(
  candidate: {
    candidateId: string;
    term: string;
    contextualMeaning: string;
    sourceSentence: string;
    surroundingContext?: string;
    cefrLevel?: string;
    categoryName?: string;
  },
  signal?: AbortSignal,
  provider: "gemini" | "ollama" = "gemini",
): Promise<{
  entry: ReturnType<typeof GeneratedPackEntrySchema.parse>;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  model: string;
  latencyMs: number;
  estimatedCostUsd: number;
} | null> {
  const systemPrompt = `You write a complete vocabulary lesson for an English learner. Follow this exact structure and field names.

${VOCABULARY_SECTION_TEMPLATE_PROMPT}

Return ONLY a JSON object with this exact shape (all fields required):
{
  "format_version": "${VOCABULARY_LESSON_FORMAT_VERSION}",
  "overview": { "meaning_usage_profile": { "meaning_type": string, "connotation": string, "tone": string, "register": string } },
  "meaning_in_context": { "source_sentence": string, "contextual_meaning": string, "simple_explanation": string },
  "usage_guide": { "when_to_use": string[], "when_not_to_use": string[] },
  "patterns_collocations": { "main_pattern": string, "common_collocations": string[] (at least 2) },
  "natural_examples": { "examples": { "<label>": string, ... } (at least 2 entries, each must contain the term "${candidate.term}"), "mini_conversation": string },
  "mistakes_differences": { "common_mistake": string, "correction": string, "important_difference": string },
  "memory_practice": { "memory_trigger": string, "memory_sentence": string (must contain "${candidate.term}"), "recall_question": string, "recognition_task": string, "production_task": string },
  "advanced_nuance": string[] (at least 1, must genuinely use "${candidate.term}")
}

Also include, as sibling top-level fields outside "lesson" is wrong -- instead return these alongside the lesson content in the SAME object:
"word": "${candidate.term}", "pronunciation": <IPA or simple phonetic>, "wordType": <part of speech>, "englishMeaning": <one-line definition>, "tamilMeaning": <Tamil translation>, "coreIdea": <one sentence core idea>.

Never use placeholder text, "TBD", generic advice, or content that doesn't specifically demonstrate "${candidate.term}".`;

  const userPrompt = `Term: ${candidate.term}\nContextual meaning: ${
    candidate.contextualMeaning
  }\nExact source sentence: ${candidate.sourceSentence}\nSurrounding context: ${
    candidate.surroundingContext || candidate.sourceSentence
  }\nCEFR level: ${candidate.cefrLevel || "B1"}\nCategory: ${
    candidate.categoryName || "general"
  }\nTamil must naturally translate only this contextual sense. Do not translate an unrelated dictionary sense.`;

  async function attempt(tier: "primary" | "escalation") {
    const result = await generateJson<Record<string, unknown>>({
      tier,
      systemPrompt,
      userPrompt,
      signal,
      responseSchema: VOCABULARY_ENTRY_RESPONSE_SCHEMA,
      provider,
    });
    const {
      word,
      pronunciation,
      wordType,
      englishMeaning,
      tamilMeaning,
      coreIdea,
      ...lesson
    } = result.data;
    const issues = generatedVocabularyEntryQualityIssues(
      { word, pronunciation, wordType, englishMeaning, tamilMeaning, coreIdea, lesson },
      {
        term: candidate.term,
        contextualMeaning: candidate.contextualMeaning,
        sourceSentence: candidate.sourceSentence,
      },
    );
    if (issues.length) {
      throw new ProviderRequestError(
        "validation_failed",
        `Quality validator rejected output:\n- ${issues.join("\n- ")}`,
        false,
      );
    }
    const entry = {
      candidateId: candidate.candidateId,
      word: String(word || candidate.term),
      pronunciation: String(pronunciation || ""),
      wordType: String(wordType || ""),
      englishMeaning: String(englishMeaning || ""),
      tamilMeaning: String(tamilMeaning || ""),
      coreIdea: String(coreIdea || ""),
      lesson,
    };
    const validation = GeneratedPackEntrySchema.safeParse(entry);
    if (!validation.success) {
      throw new ProviderRequestError(
        "validation_failed",
        `Entry failed schema validation: ${validation.error.issues
          .map((i) => i.message)
          .join("; ")}`,
        false,
      );
    }
    return {
      entry: validation.data,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cachedTokens: result.cachedTokens,
      model: result.model,
      latencyMs: result.latencyMs,
      estimatedCostUsd: result.estimatedCostUsd,
    };
  }

  try {
    return await attempt("primary");
  } catch (primaryError) {
    const classified = classifyProviderFailure(primaryError);
    if (!["validation_failed", "malformed_json"].includes(classified.code))
      throw classified;
    logger.warn(
      `Primary-tier generation failed for "${candidate.term}", escalating: ${
        (primaryError as Error).message
      }`,
    );
    try {
      return await attempt("escalation");
    } catch (escalationError) {
      const classifiedEscalation = classifyProviderFailure(escalationError);
      if (
        !["validation_failed", "malformed_json"].includes(
          classifiedEscalation.code,
        )
      )
        throw classifiedEscalation;
      logger.error(
        `Escalation-tier generation also failed for "${candidate.term}"`,
        escalationError,
      );
      return null;
    }
  }
}

export function buildManifestDocument(params: {
  manifestId: string;
  sourceName: string;
  sourceType: string;
  contentHash: string;
  totalPages: number;
  candidates: ReturnType<typeof toManifestCandidate>[];
  pages: Array<{
    page: number;
    status: "assessed" | "unreadable";
    chunkIds: string[];
    error?: string;
  }>;
  chunks: Array<{
    chunkId: string;
    pageStart: number;
    pageEnd: number;
    status: "assessed" | "unreadable";
    candidateIds: string[];
    error?: string;
  }>;
}) {
  const validCandidates = params.candidates.filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );
  const generateCount = validCandidates.filter(
    (c) => c.decision === "generate",
  ).length;

  return {
    formatVersion: CONTENT_MANIFEST_VERSION,
    manifestId: params.manifestId,
    createdAt: new Date().toISOString(),
    source: {
      name: params.sourceName,
      type: params.sourceType as any,
      contentHash: params.contentHash,
      totalPages: params.totalPages,
      totalChunks: params.chunks.length,
    },
    coverage: {
      pages: params.pages,
      chunks: params.chunks,
    },
    candidates: validCandidates,
    counts: {
      totalCandidates: validCandidates.length,
      generate: generateCount,
      existing: validCandidates.filter((c) => c.decision === "existing").length,
      filtered: validCandidates.filter((c) => c.decision === "filtered").length,
      rejected: validCandidates.filter((c) => c.decision === "rejected").length,
      heavyUse: validCandidates.filter(
        (c) => "usageFrequency" in c && c.usageFrequency === "heavy",
      ).length,
      mediumUse: validCandidates.filter(
        (c) => "usageFrequency" in c && c.usageFrequency === "medium",
      ).length,
    },
    generationPlan: {
      batchSize: 8,
      batches: planGenerationBatches(
        validCandidates
          .filter((c) => c.decision === "generate")
          .map((c) => c.candidateId),
      ).map((candidateIds, index) => ({
        batchNumber: index + 1,
        candidateIds,
      })),
    },
  };
}

export function chunkIntoBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/** Deterministically balances normal batches around 8 without a 1-4 item tail. */
export function planGenerationBatches<T>(items: T[]): T[][] {
  if (items.length <= 10) return items.length ? [items.slice()] : [];
  const batchCount = Math.ceil(items.length / 8);
  const base = Math.floor(items.length / batchCount);
  const larger = items.length % batchCount;
  const result: T[][] = [];
  let offset = 0;
  for (let index = 0; index < batchCount; index += 1) {
    const size = base + (index < larger ? 1 : 0);
    if (size < 5 || size > 10)
      throw new Error("Generation plan cannot satisfy the 5-10 batch contract");
    result.push(items.slice(offset, offset + size));
    offset += size;
  }
  return result;
}

export function buildBatchDocument(params: {
  batchId: string;
  manifestId: string;
  manifestHash: string;
  batchNumber: number;
  entries: NonNullable<ReturnType<typeof GeneratedPackEntrySchema.parse>>[];
}) {
  return {
    formatVersion: CONTENT_BATCH_VERSION,
    batchId: params.batchId,
    manifestId: params.manifestId,
    manifestHash: params.manifestHash,
    batchNumber: params.batchNumber,
    createdAt: new Date().toISOString(),
    entries: params.entries,
  };
}
