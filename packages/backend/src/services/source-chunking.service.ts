import {
  normalizeSourceText,
  sentenceRanges,
  SourceSegment,
  stableExtractionId,
} from "./extraction-foundation.service";

export interface SourceChunkingOptions {
  targetWords: number;
  maxWords: number;
  overlapWords: number;
}

export const DEFAULT_SOURCE_CHUNKING: SourceChunkingOptions = {
  targetWords: 1250,
  maxWords: 1500,
  overlapWords: 40,
};

export interface SourceChunkSpan {
  sourceUnitId: string;
  sourceUnitSequence: number;
  startOffset: number;
  endOffset: number;
  wordCount: number;
}

export interface SourceProcessingChunk {
  chunkId: string;
  sequence: number;
  text: string;
  wordCount: number;
  spans: SourceChunkSpan[];
  contextBefore: string;
  contextAfter: string;
  status: "pending";
}

export interface SourceChunkPlan {
  formatVersion: "source-chunk-plan-v1";
  sourceUnitCount: number;
  readableUnitCount: number;
  unreadableUnitCount: number;
  emptyUnitCount: number;
  readableWordCount: number;
  chunkCount: number;
  chunks: SourceProcessingChunk[];
  reconciliation: {
    readableUnitsAccountedFor: number;
    readableWordsAccountedFor: number;
    untrackedReadableUnits: number;
    untrackedReadableWords: number;
  };
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

function wordRanges(text: string) {
  return [...text.matchAll(WORD)].map((match) => ({
    start: match.index!,
    end: match.index! + match[0].length,
  }));
}

function countWords(text: string) {
  return wordRanges(text).length;
}

function splitRangeByWords(
  text: string,
  start: number,
  end: number,
  maxWords: number,
) {
  const words = wordRanges(text.slice(start, end));
  if (words.length <= maxWords) return [{ start, end, wordCount: words.length }];
  const result: Array<{ start: number; end: number; wordCount: number }> = [];
  for (let index = 0; index < words.length; index += maxWords) {
    const first = words[index];
    const last = words[Math.min(index + maxWords, words.length) - 1];
    result.push({
      start: start + first.start,
      end: start + last.end,
      wordCount: Math.min(maxWords, words.length - index),
    });
  }
  return result;
}

function unitSpans(unit: SourceSegment, maxWords: number): SourceChunkSpan[] {
  const sentences = sentenceRanges(unit.originalText);
  const ranges = sentences.length
    ? sentences.flatMap((sentence) =>
        splitRangeByWords(
          unit.originalText,
          sentence.start,
          sentence.end,
          maxWords,
        ),
      )
    : splitRangeByWords(unit.originalText, 0, unit.originalText.length, maxWords);

  const packed: Array<{ start: number; end: number; wordCount: number }> = [];
  for (const range of ranges.filter((item) => item.wordCount > 0)) {
    const current = packed[packed.length - 1];
    if (current && current.wordCount + range.wordCount <= maxWords) {
      current.end = range.end;
      current.wordCount += range.wordCount;
    } else {
      packed.push({ ...range });
    }
  }
  if (!packed.length && unit.originalText.length) {
    packed.push({ start: 0, end: unit.originalText.length, wordCount: 0 });
  }
  return packed.map((range) => ({
    sourceUnitId: unit.segmentId,
    sourceUnitSequence: unit.sequence,
    startOffset: unit.locator.startOffset + range.start,
    endOffset: unit.locator.startOffset + range.end,
    wordCount: range.wordCount,
  }));
}

function contextWords(text: string, limit: number, fromEnd: boolean) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return (fromEnd ? words.slice(-limit) : words.slice(0, limit)).join(" ");
}

export function buildSourceChunkPlan(
  sourceUnits: SourceSegment[],
  options: Partial<SourceChunkingOptions> = {},
): SourceChunkPlan {
  const config = { ...DEFAULT_SOURCE_CHUNKING, ...options };
  if (config.targetWords < 1 || config.maxWords < config.targetWords)
    throw new Error("Source chunk limits must satisfy 1 <= targetWords <= maxWords.");
  if (config.overlapWords < 0)
    throw new Error("Source chunk overlapWords cannot be negative.");

  const readable = sourceUnits.filter((unit) => unit.status === "readable");
  const byId = new Map(readable.map((unit) => [unit.segmentId, unit]));
  const spans = readable.flatMap((unit) => unitSpans(unit, config.maxWords));
  const grouped: SourceChunkSpan[][] = [];
  for (const span of spans) {
    const current = grouped[grouped.length - 1];
    const currentWords = current?.reduce((sum, item) => sum + item.wordCount, 0) ?? 0;
    if (!current || currentWords >= config.targetWords || currentWords + span.wordCount > config.maxWords)
      grouped.push([span]);
    else current.push(span);
  }

  const textForSpan = (span: SourceChunkSpan) => {
    const unit = byId.get(span.sourceUnitId)!;
    const localStart = span.startOffset - unit.locator.startOffset;
    const localEnd = span.endOffset - unit.locator.startOffset;
    return unit.originalText.slice(localStart, localEnd).trim();
  };
  const chunkTexts = grouped.map((group) => group.map(textForSpan).join("\n\n"));
  const chunks = grouped.map((group, index): SourceProcessingChunk => {
    const identity = group.map(({ sourceUnitId, startOffset, endOffset }) => ({
      sourceUnitId,
      startOffset,
      endOffset,
    }));
    return {
      chunkId: `chunk-${String(index + 1).padStart(5, "0")}-${stableExtractionId(identity).slice(0, 16)}`,
      sequence: index + 1,
      text: normalizeSourceText(chunkTexts[index]),
      wordCount: group.reduce((sum, span) => sum + span.wordCount, 0),
      spans: group,
      contextBefore: index === 0 ? "" : contextWords(chunkTexts[index - 1], config.overlapWords, true),
      contextAfter: index === grouped.length - 1 ? "" : contextWords(chunkTexts[index + 1], config.overlapWords, false),
      status: "pending",
    };
  });

  const coveredUnitIds = new Set(chunks.flatMap((chunk) => chunk.spans.map((span) => span.sourceUnitId)));
  const readableWordCount = readable.reduce((sum, unit) => sum + countWords(unit.originalText), 0);
  const accountedWords = chunks.reduce((sum, chunk) => sum + chunk.wordCount, 0);
  return {
    formatVersion: "source-chunk-plan-v1",
    sourceUnitCount: sourceUnits.length,
    readableUnitCount: readable.length,
    unreadableUnitCount: sourceUnits.filter((unit) => unit.status === "unreadable").length,
    emptyUnitCount: sourceUnits.filter((unit) => unit.status === "empty").length,
    readableWordCount,
    chunkCount: chunks.length,
    chunks,
    reconciliation: {
      readableUnitsAccountedFor: coveredUnitIds.size,
      readableWordsAccountedFor: accountedWords,
      untrackedReadableUnits: readable.filter((unit) => !coveredUnitIds.has(unit.segmentId)).length,
      untrackedReadableWords: readableWordCount - accountedWords,
    },
  };
}
