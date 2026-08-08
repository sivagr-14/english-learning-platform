import { createHash } from "crypto";
import {
  TAXONOMY_SPECIFIC_CATEGORIES,
  taxonomyPathForCategoryKey,
} from "../data/vocabulary-taxonomy";
import {
  VOCABULARY_SECTION_TEMPLATE_PROMPT,
  VOCABULARY_LESSON_FORMAT_VERSION,
  vocabularyLessonQualityIssues,
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

interface RawCandidate {
  term: string;
  baseForm: string;
  itemType: string;
  contextualMeaning: string;
  categoryKey: string;
  domainKey: string;
  usageGroupKey: string;
  taxonomyConfidence: "high" | "medium" | "low";
  taxonomyReason?: string;
  cefrLevel: string;
  usageFrequency: "heavy" | "medium";
  fluencyValue: "essential" | "useful" | "specialized";
  sourceSentence: string;
  senseExplanation: string;
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
  deterministicCandidates: string[] = [],
): Promise<RawCandidate[]> {
  const systemPrompt = `You identify English vocabulary worth teaching an intermediate-to-advanced learner from a passage of text. You only propose words/phrases that are genuinely useful to learn -- not every word in the passage. Skip basic A1 vocabulary a learner already knows (e.g. "the", "go", "happy"). Prefer collocations, phrasal verbs, idioms, and words used in a non-obvious sense over isolated common words.

Return ONLY a JSON object: { "candidates": [ ... ] }. Each candidate:
{
  "term": string (as it appears or its dictionary form),
  "baseForm": string (dictionary/lemma form),
  "itemType": one of "word" | "phrasal verb" | "idiom" | "collocation" | "fixed phrase" | "conversational pattern",
  "contextualMeaning": string (at least 8 characters, explains the meaning AS USED in this passage),
  "domainKey": string, "usageGroupKey": string, "categoryKey": string (copy one complete hierarchy below exactly),
  "taxonomyConfidence": one of "high" | "medium" | "low",
  "taxonomyReason": string (required when confidence is low),
  "cefrLevel": one of "A1"|"A2"|"B1"|"B2"|"C1"|"C2",
  "usageFrequency": "heavy" | "medium" (never "low" -- if it's low-frequency, omit the candidate entirely),
  "fluencyValue": "essential" | "useful" | "specialized",
  "sourceSentence": string (the exact sentence from the passage containing the term),
  "senseExplanation": string (at least 8 characters, why this sense/usage matters)
}

Propose at most 15 candidates for this passage. Quality over quantity.

Valid categoryKey values (format "key :: display name"):
${TAXONOMY_CATALOG_PROMPT}`;

  const result = await generateJson<{ candidates: RawCandidate[] }>({
    tier: "primary",
    systemPrompt,
    userPrompt: `Passage (chunkId: ${chunkId}):\n\n${chunkText}\n\nDeterministically enumerated terms/expressions (classify each; do not silently omit -- return useful heavy/medium items and let policy account for the rest):\n${deterministicCandidates.join("\n")}`,
    signal,
  });

  return (result.data.candidates || []).filter((candidate) => {
    const path = taxonomyPathForCategoryKey(candidate.categoryKey);
    const valid =
      path &&
      candidate.domainKey === path.domainKey &&
      candidate.usageGroupKey === path.usageGroupKey;
    if (!valid) {
      logger.warn(
        `Assessment proposed an invented or mismatched taxonomy path for "${candidate.term}"; dropping candidate`,
      );
    }
    if (
      candidate.taxonomyConfidence === "low" &&
      !candidate.taxonomyReason?.trim()
    )
      return false;
    return Boolean(valid);
  });
}

/**
 * Builds a schema-valid manifest candidate from a raw assessment result.
 * Returns null (and logs) if the resulting object still fails validation
 * after assembly -- callers should drop it rather than fail the whole
 * manifest over one bad candidate.
 */
export function toManifestCandidate(
  raw: RawCandidate,
  chunkId: string,
  page: number,
) {
  const taxonomyPath = taxonomyPathForCategoryKey(raw.categoryKey)!;
  const candidate = {
    candidateId: `cand-${createHash("sha256")
      .update(
        `${(raw.baseForm || raw.term).normalize("NFKC").toLowerCase()}\u0000${raw.contextualMeaning.normalize("NFKC").toLowerCase()}`,
      )
      .digest("hex")
      .slice(0, 24)}`,
    term: raw.term,
    baseForm: raw.baseForm || raw.term,
    itemType: raw.itemType as any,
    decision: "generate" as const,
    senseDecision: "new_sense" as const,
    senseKey: `${raw.baseForm || raw.term}:${raw.categoryKey}`.slice(0, 180),
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
    occurrences: [{ page, chunkId, sentence: raw.sourceSentence }],
  };

  const validation = ManifestCandidateSchema.safeParse(candidate);
  if (!validation.success) {
    logger.warn(
      `Dropping candidate "${raw.term}": ${validation.error.issues
        .map((i) => i.message)
        .join("; ")}`,
    );
    return null;
  }
  return validation.data;
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
    cefrLevel?: string;
    categoryName?: string;
  },
  signal?: AbortSignal,
): Promise<{
  entry: ReturnType<typeof GeneratedPackEntrySchema.parse>;
  inputTokens: number;
  outputTokens: number;
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
  }\nCEFR level: ${candidate.cefrLevel || "B1"}\nCategory: ${
    candidate.categoryName || "general"
  }`;

  async function attempt(tier: "primary" | "escalation") {
    const result = await generateJson<Record<string, unknown>>({
      tier,
      systemPrompt,
      userPrompt,
      signal,
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
    const issues = vocabularyLessonQualityIssues(lesson, candidate.term);
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
  chunkIds: string[];
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
      totalChunks: params.chunkIds.length,
    },
    coverage: {
      pages: Array.from({ length: params.totalPages }, (_, i) => ({
        page: i + 1,
        status: "assessed" as const,
        chunkIds: params.chunkIds,
      })),
      chunks: params.chunkIds.map((chunkId, index) => ({
        chunkId,
        pageStart: index + 1,
        pageEnd: index + 1,
        status: "assessed" as const,
        candidateIds: validCandidates
          .filter((c) => c.occurrences.some((o) => o.chunkId === chunkId))
          .map((c) => c.candidateId),
      })),
    },
    candidates: validCandidates,
    counts: {
      totalCandidates: validCandidates.length,
      generate: generateCount,
      existing: 0,
      filtered: 0,
      rejected: 0,
      heavyUse: validCandidates.filter(
        (c) => "usageFrequency" in c && c.usageFrequency === "heavy",
      ).length,
      mediumUse: validCandidates.filter(
        (c) => "usageFrequency" in c && c.usageFrequency === "medium",
      ).length,
    },
    generationPlan: {
      batchSize: 10,
      batches: chunkIntoBatches(
        validCandidates
          .filter((c) => c.decision === "generate")
          .map((c) => c.candidateId),
        10,
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
