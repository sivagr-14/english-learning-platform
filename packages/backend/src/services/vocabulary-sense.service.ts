export const SENSE_DECISIONS = [
  "same_sense",
  "new_sense",
  "ambiguous",
] as const;

export type SenseDecision = (typeof SENSE_DECISIONS)[number];

export interface ExistingVocabularySense {
  id: string;
  word: string;
  normalized_term?: string | null;
  sense_rank?: number | string | null;
  sense_key?: string | null;
  sense_gloss?: string | null;
  english_meaning?: string | null;
}

export interface SenseResolutionInput {
  term: string;
  contextualMeaning: string;
  senseKey: string;
  declaredDecision: SenseDecision;
  matchedWordId?: string | null;
}

export type SenseResolution =
  | {
      decision: "same_sense";
      matchedSense: ExistingVocabularySense;
      reason: string;
    }
  | {
      decision: "new_sense";
      matchedSense: null;
      reason: string;
    }
  | {
      decision: "ambiguous";
      matchedSense: ExistingVocabularySense | null;
      reason: string;
    };

const MEANING_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "used",
  "very",
  "extremely",
  "when",
  "with",
]);

export function normalizeVocabularyTerm(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

export function normalizeSenseKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

const MEANING_TOKEN_EQUIVALENTS: Record<string, string> = {
  ambition: "motivation",
  ambitious: "motivation",
  determined: "motivation",
  determination: "motivation",
  desire: "motivation",
  driven: "motivation",
  achieve: "success",
  achieved: "success",
  achievement: "success",
  goals: "success",
  succeed: "success",
  succeeded: "success",
  successful: "success",
  unusual: "strange",
  odd: "strange",
  weird: "strange",
};

function canonicalMeaningToken(token: string): string {
  return MEANING_TOKEN_EQUIVALENTS[token] || token;
}

function meaningTokens(value: string): Set<string> {
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !MEANING_STOP_WORDS.has(token))
    .map(canonicalMeaningToken);
  return new Set(normalized);
}

export function contextualMeaningSimilarity(
  left: string,
  right: string,
): number {
  const leftTokens = meaningTokens(left);
  const rightTokens = meaningTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;

  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  ).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const smaller = Math.min(leftTokens.size, rightTokens.size);
  const jaccard = union ? intersection / union : 0;
  const containment = smaller ? intersection / smaller : 0;
  // Equivalent dictionary glosses often differ in explanatory detail. The
  // overlap coefficient catches a concise gloss contained in a longer
  // paraphrase, while the same-term guard in resolveContextualSense prevents
  // matches across unrelated vocabulary.
  return Math.max(jaccard, containment);
}

export function senseRankToLetters(rank: number): string {
  if (!Number.isInteger(rank) || rank < 1) {
    throw new Error("Sense rank must be a positive integer.");
  }

  let value = rank;
  let letters = "";
  while (value > 0) {
    value -= 1;
    letters = String.fromCharCode(65 + (value % 26)) + letters;
    value = Math.floor(value / 26);
  }
  return letters;
}

export function displayVocabularyLabel(
  word: string,
  senseRank?: number | string | null,
): string {
  const rank = Number(senseRank || 1);
  return rank <= 1 ? word : `${word} (${senseRankToLetters(rank)})`;
}

export function lettersToSenseRank(letters: string): number {
  const normalized = letters.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) {
    throw new Error("Sense label must contain letters only.");
  }
  return [...normalized].reduce(
    (rank, letter) => rank * 26 + letter.charCodeAt(0) - 64,
    0,
  );
}

export function parseVocabularyDisplayLabel(value: string): {
  term: string;
  senseRank: number | null;
} {
  const match = value.trim().match(/^(.*?)\s+\(([A-Z]+)\)$/i);
  if (!match) return { term: value.trim(), senseRank: null };
  return {
    term: match[1].trim(),
    senseRank: lettersToSenseRank(match[2]),
  };
}

export async function allocatePersistentSenseRank(
  trx: any,
  userId: string,
  normalizedTerm: string,
): Promise<number> {
  const result = await trx.raw(
    `
      INSERT INTO vocabulary_sense_counters (
        owner_user_id,
        normalized_term,
        next_rank,
        updated_at
      )
      VALUES (?, ?, 2, CURRENT_TIMESTAMP)
      ON CONFLICT (owner_user_id, normalized_term)
      DO UPDATE SET
        next_rank = vocabulary_sense_counters.next_rank + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING next_rank - 1 AS allocated_rank
    `,
    [userId, normalizedTerm],
  );
  const allocatedRank = Number(result.rows?.[0]?.allocated_rank);
  if (!Number.isInteger(allocatedRank) || allocatedRank < 1) {
    throw new Error(`Could not allocate a sense rank for "${normalizedTerm}".`);
  }
  return allocatedRank;
}

export async function lockVocabularyTerm(
  trx: any,
  userId: string,
  normalizedTerm: string,
): Promise<void> {
  await trx.raw(
    `SELECT pg_advisory_xact_lock(
      hashtextextended(CAST(? AS text), 0)
    )`,
    [`${userId}:${normalizedTerm}`],
  );
}

export function resolveContextualSense(
  input: SenseResolutionInput,
  existingSenses: ExistingVocabularySense[],
): SenseResolution {
  if (input.declaredDecision === "ambiguous") {
    return {
      decision: "ambiguous",
      matchedSense: null,
      reason: "The source does not establish one reliable contextual meaning.",
    };
  }

  const normalizedTerm = normalizeVocabularyTerm(input.term);
  const normalizedKey = normalizeSenseKey(input.senseKey);
  const senses = existingSenses.filter(
    (sense) =>
      normalizeVocabularyTerm(sense.normalized_term || sense.word) ===
      normalizedTerm,
  );

  if (input.matchedWordId) {
    const explicit = senses.find((sense) => sense.id === input.matchedWordId);
    if (!explicit) {
      return {
        decision: "ambiguous",
        matchedSense: null,
        reason:
          "The declared matched word is unavailable or belongs to another term.",
      };
    }
    const explicitKey = normalizeSenseKey(explicit.sense_key || "");
    if (explicitKey && explicitKey !== normalizedKey) {
      return {
        decision: "ambiguous",
        matchedSense: explicit,
        reason: "The declared matched word has a conflicting sense key.",
      };
    }
    return {
      decision: "same_sense",
      matchedSense: explicit,
      reason: "The manifest explicitly matched this contextual sense.",
    };
  }

  const exactKeyMatch = normalizedKey
    ? senses.find(
        (sense) => normalizeSenseKey(sense.sense_key || "") === normalizedKey,
      )
    : undefined;
  if (exactKeyMatch) {
    return {
      decision: "same_sense",
      matchedSense: exactKeyMatch,
      reason: "The stable sense key matches an existing contextual sense.",
    };
  }

  const ranked = senses
    .map((sense) => ({
      sense,
      similarity: contextualMeaningSimilarity(
        input.contextualMeaning,
        sense.sense_gloss || sense.english_meaning || "",
      ),
    }))
    .sort((left, right) => right.similarity - left.similarity);
  const closest = ranked[0];

  if (closest && closest.similarity >= 0.6) {
    return {
      decision: "same_sense",
      matchedSense: closest.sense,
      reason: "The contextual gloss strongly matches an existing sense.",
    };
  }

  if (input.declaredDecision === "same_sense") {
    return {
      decision: "ambiguous",
      matchedSense: closest?.sense || null,
      reason:
        "The manifest declared an existing sense, but no reliable match was found.",
    };
  }

  // A source-backed new-sense decision is authoritative once exact keys and
  // strong semantic matches have been ruled out. Moderate token overlap often
  // occurs between genuinely different meanings and must not manufacture a
  // manual-approval gate in the automatic import workflow.
  if (input.declaredDecision === "new_sense") {
    return {
      decision: "new_sense",
      matchedSense: null,
      reason: senses.length
        ? "The declared contextual sense is distinct from every strongly matching stored sense."
        : "This is the first stored sense for the term.",
    };
  }

  if (closest && closest.similarity >= 0.3) {
    return {
      decision: "ambiguous",
      matchedSense: closest.sense,
      reason:
        "The meaning partly overlaps an existing sense and requires attention.",
    };
  }

  return {
    decision: "new_sense",
    matchedSense: null,
    reason: senses.length
      ? "The contextual meaning is distinct from every stored sense."
      : "This is the first stored sense for the term.",
  };
}
