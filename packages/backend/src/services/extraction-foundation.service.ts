import { createHash } from "crypto";
import { normalizeVocabularyTerm } from "./vocabulary-sense.service";

export type SegmentStatus = "readable" | "empty" | "unreadable" | "attention";
export interface SourceLocator {
  unit: "document" | "page" | "paragraph" | "chapter" | "cue";
  unitIndex: number;
  page?: number;
  paragraph?: number;
  chapter?: string;
  cue?: number;
  startTime?: string;
  endTime?: string;
  startOffset: number;
  endOffset: number;
}
export interface SourceSegment {
  segmentId: string;
  sequence: number;
  originalText: string;
  normalizedText: string;
  locator: SourceLocator;
  status: SegmentStatus;
  error?: string;
  contentHash: string;
}

export function normalizeSourceText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .trim();
}

export function stableExtractionId(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function makeSegment(
  input: Omit<SourceSegment, "segmentId" | "normalizedText" | "contentHash">,
): SourceSegment {
  const normalizedText = normalizeSourceText(input.originalText);
  const status =
    input.status === "readable" && !normalizedText ? "empty" : input.status;
  const contentHash = stableExtractionId(input.originalText);
  return {
    ...input,
    status,
    normalizedText,
    contentHash,
    segmentId: stableExtractionId({
      sequence: input.sequence,
      locator: input.locator,
      contentHash,
    }).slice(0, 32),
  };
}

export interface CandidateOccurrence {
  segmentId: string;
  surfaceForm: string;
  sentence: string;
  startOffset: number;
  endOffset: number;
  locator: SourceLocator;
}
export interface EnumeratedCandidate {
  candidateId: string;
  normalizedTerm: string;
  baseForm: string;
  itemType: "word" | "phrasal verb" | "idiom" | "collocation" | "fixed phrase";
  occurrences: CandidateOccurrence[];
  detection: string[];
}

const STOP = new Set(
  "a an and are as at be been but by for from had has have he her hers him his i in is it its me my of on or our she that the their them they this to was we were will with you your".split(
    " ",
  ),
);
// High-confidence patterns complement, but never bound, open n-gram discovery.
const EXPRESSIONS = [
  "amount to",
  "back down",
  "break down",
  "bring up",
  "carry on",
  "come across",
  "figure out",
  "find out",
  "give up",
  "go through",
  "look after",
  "look into",
  "make up",
  "put off",
  "run into",
  "set up",
  "take off",
  "turn down",
  "work out",
  "as a result",
  "in spite of",
  "on the other hand",
];

function lemma(token: string): string {
  if (token.length > 5 && token.endsWith("ies"))
    return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing"))
    return token.slice(0, -3).replace(/(.)\1$/, "$1");
  if (token.length > 4 && token.endsWith("ed"))
    return token.slice(0, -2).replace(/(.)\1$/, "$1");
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss"))
    return token.slice(0, -1);
  return token;
}

function verbForms(verb: string): string {
  const irregular: Record<string, string[]> = {
    carry: ["carry", "carries", "carried", "carrying"],
    turn: ["turn", "turns", "turned", "turning"],
  };
  const forms = irregular[verb] ?? [
    verb,
    `${verb}s`,
    `${verb}ed`,
    `${verb}ing`,
  ];
  return `(?:${forms.join("|")})`;
}

export function sentenceRanges(
  text: string,
): Array<{ text: string; start: number; end: number }> {
  const result: Array<{ text: string; start: number; end: number }> = [];
  const re = /[^.!?\n]+(?:[.!?]+|$)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const leading = match[0].search(/\S/);
    if (leading < 0) continue;
    const value = match[0].trim();
    result.push({
      text: value,
      start: match.index + leading,
      end: match.index + leading + value.length,
    });
  }
  return result;
}

export function enumerateCandidates(
  segments: SourceSegment[],
): EnumeratedCandidate[] {
  const found = new Map<string, EnumeratedCandidate>();
  const add = (
    term: string,
    baseForm: string,
    itemType: EnumeratedCandidate["itemType"],
    occurrence: CandidateOccurrence,
    detection: string,
  ) => {
    const normalizedTerm = normalizeVocabularyTerm(baseForm);
    const key = `${itemType}:${normalizedTerm}`;
    const current = found.get(key) ?? {
      candidateId: stableExtractionId(key).slice(0, 32),
      normalizedTerm,
      baseForm,
      itemType,
      occurrences: [],
      detection: [],
    };
    if (
      !current.occurrences.some(
        (o) =>
          o.segmentId === occurrence.segmentId &&
          o.startOffset === occurrence.startOffset &&
          o.endOffset === occurrence.endOffset,
      )
    )
      current.occurrences.push(occurrence);
    if (!current.detection.includes(detection))
      current.detection.push(detection);
    found.set(key, current);
  };
  for (const segment of segments.filter((s) => s.status === "readable"))
    for (const sentence of sentenceRanges(segment.originalText)) {
      const wordRe = /[\p{L}][\p{L}'’-]*/gu;
      let word: RegExpExecArray | null;
      while ((word = wordRe.exec(sentence.text))) {
        const surface = word[0];
        const normalized = normalizeVocabularyTerm(surface);
        if (normalized.length < 3 || STOP.has(normalized)) continue;
        const startOffset =
          segment.locator.startOffset + sentence.start + word.index;
        add(
          surface,
          lemma(normalized),
          "word",
          {
            segmentId: segment.segmentId,
            surfaceForm: surface,
            sentence: sentence.text,
            startOffset,
            endOffset: startOffset + surface.length,
            locator: segment.locator,
          },
          "token+lemma",
        );
      }
      // Enumerate every plausible 2-5 word lexical unit before model/policy
      // filtering. This is intentionally open-ended: the former curated list
      // silently capped expression recall and made large-source reconciliation
      // impossible to prove.
      const tokens = [...sentence.text.matchAll(/[\p{L}][\p{L}'’-]*/gu)];
      for (let width = 2; width <= 5; width += 1) {
        for (let index = 0; index + width <= tokens.length; index += 1) {
          const slice = tokens.slice(index, index + width);
          const normalizedParts = slice.map((token) =>
            normalizeVocabularyTerm(token[0]),
          );
          if (normalizedParts.filter((part) => !STOP.has(part)).length < 2)
            continue;
          if (EXPRESSIONS.includes(normalizedParts.join(" "))) continue;
          const first = slice[0];
          const last = slice[slice.length - 1];
          const localStart = first.index!;
          const localEnd = last.index! + last[0].length;
          const surface = sentence.text.slice(localStart, localEnd);
          const startOffset =
            segment.locator.startOffset + sentence.start + localStart;
          add(
            surface,
            normalizedParts.join(" "),
            "collocation",
            {
              segmentId: segment.segmentId,
              surfaceForm: surface,
              sentence: sentence.text,
              startOffset,
              endOffset: startOffset + surface.length,
              locator: segment.locator,
            },
            `open-ngram-${width}`,
          );
        }
      }
      const lower = normalizeSourceText(sentence.text).toLowerCase();
      for (const expression of EXPRESSIONS) {
        const parts = expression.split(" ");
        const escaped =
          parts.length === 2
            ? `${verbForms(parts[0])}(?:\\s+|\\s+(?:\\w+\\s+){1,3})${parts[1]}`
            : expression.replace(/ /g, "\\s+");
        const re = new RegExp(`\\b${escaped}\\b`, "i");
        const hit = re.exec(lower);
        if (!hit) continue;
        const startOffset =
          segment.locator.startOffset + sentence.start + hit.index;
        const type =
          expression.split(" ").length === 2 ? "phrasal verb" : "fixed phrase";
        add(
          hit[0],
          expression,
          type,
          {
            segmentId: segment.segmentId,
            surfaceForm: hit[0],
            sentence: sentence.text,
            startOffset,
            endOffset: startOffset + hit[0].length,
            locator: segment.locator,
          },
          "curated-expression+ngram",
        );
      }
    }
  return [...found.values()].sort((a, b) =>
    a.candidateId.localeCompare(b.candidateId),
  );
}

export type PolicyDecision =
  "generate" | "existing" | "filtered" | "rejected" | "attention";
export interface PolicyResult {
  decision: PolicyDecision;
  reasonCode: string;
  reason: string;
}
export function applyCandidatePolicy(
  candidate: EnumeratedCandidate,
  frequency: "heavy" | "medium" | "low" = "medium",
): PolicyResult {
  if (
    !candidate.normalizedTerm ||
    /\d{4,}|[^\p{L}\p{N}' -]/u.test(candidate.normalizedTerm)
  )
    return {
      decision: "rejected",
      reasonCode: "MALFORMED_TOKEN",
      reason:
        "The candidate contains malformed or extraction-noise characters.",
    };
  if (frequency === "low")
    return {
      decision: "filtered",
      reasonCode: "LOW_FREQUENCY_SENSE",
      reason:
        "This contextual sense is low-frequency under the stored import policy.",
    };
  const surfaces = candidate.occurrences.map((o) => o.surfaceForm);
  if (
    surfaces.length &&
    surfaces.every((s) => /^[A-Z][\p{L}'-]+$/u.test(s)) &&
    candidate.occurrences.every((o) => o.startOffset > o.locator.startOffset)
  )
    return {
      decision: "filtered",
      reasonCode: "PROPER_NAME",
      reason:
        "All observed forms are capitalized away from sentence start and appear to be a proper name.",
    };
  return {
    decision: "generate",
    reasonCode: frequency === "heavy" ? "USEFUL_HEAVY" : "USEFUL_MEDIUM",
    reason: `The candidate is a ${frequency}-frequency useful contextual term.`,
  };
}

export interface SenseCandidate extends EnumeratedCandidate {
  senseKey: string;
  contextualMeaning: string;
}
export function deduplicateByContextualSense(
  candidates: SenseCandidate[],
): SenseCandidate[] {
  const merged = new Map<string, SenseCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.normalizedTerm}:${candidate.senseKey}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...candidate,
        occurrences: [...candidate.occurrences],
      });
      continue;
    }
    for (const occurrence of candidate.occurrences)
      if (
        !current.occurrences.some(
          (o) =>
            o.segmentId === occurrence.segmentId &&
            o.startOffset === occurrence.startOffset,
        )
      )
        current.occurrences.push(occurrence);
  }
  return [...merged.values()].sort((a, b) =>
    `${a.normalizedTerm}:${a.senseKey}`.localeCompare(
      `${b.normalizedTerm}:${b.senseKey}`,
    ),
  );
}

export function buildGenerationPlan<T extends { candidateId: string }>(
  candidates: T[],
  batchSize = 8,
): T[][] {
  if (batchSize < 1 || batchSize > 10)
    throw new Error("Generation batch size must be between 1 and 10.");
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.candidateId))
      throw new Error(
        `Candidate ${candidate.candidateId} appears more than once in the generation plan.`,
      );
    seen.add(candidate.candidateId);
  }
  const result: T[][] = [];
  for (let i = 0; i < candidates.length; i += batchSize)
    result.push(candidates.slice(i, i + batchSize));
  return result;
}
