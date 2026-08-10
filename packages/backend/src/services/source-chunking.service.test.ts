import { makeSegment } from "./extraction-foundation.service";
import { buildSourceChunkPlan } from "./source-chunking.service";

function unit(text: string, sequence: number) {
  return makeSegment({
    sequence,
    originalText: text,
    status: "readable",
    locator: {
      unit: "paragraph",
      unitIndex: sequence,
      paragraph: sequence,
      startOffset: (sequence - 1) * 100000,
      endOffset: (sequence - 1) * 100000 + text.length,
    },
  });
}

describe("bounded source chunk planning", () => {
  test("small content remains one fully reconciled chunk", () => {
    const plan = buildSourceChunkPlan([unit("A short but useful passage.", 1)]);
    expect(plan.chunkCount).toBe(1);
    expect(plan.reconciliation).toEqual({
      readableUnitsAccountedFor: 1,
      readableWordsAccountedFor: 5,
      untrackedReadableUnits: 0,
      untrackedReadableWords: 0,
    });
  });

  test("10,000 words become bounded stable chunks without losing source coverage", () => {
    const units = Array.from({ length: 100 }, (_, unitIndex) =>
      unit(
        Array.from({ length: 100 }, (_, wordIndex) => `word${unitIndex}x${wordIndex}`).join(" ") + ".",
        unitIndex + 1,
      ),
    );
    const first = buildSourceChunkPlan(units);
    const second = buildSourceChunkPlan(units);
    expect(first.chunkCount).toBeGreaterThanOrEqual(7);
    expect(first.chunkCount).toBeLessThanOrEqual(10);
    expect(first.chunks.every((chunk) => chunk.wordCount <= 1500)).toBe(true);
    expect(first.chunks.map((chunk) => chunk.chunkId)).toEqual(second.chunks.map((chunk) => chunk.chunkId));
    expect(first.reconciliation).toMatchObject({
      readableUnitsAccountedFor: 100,
      readableWordsAccountedFor: 10000,
      untrackedReadableUnits: 0,
      untrackedReadableWords: 0,
    });
  });

  test("50,000 words preserve every source unit and word in stable bounded chunks", () => {
    const units = Array.from({ length: 500 }, (_, unitIndex) =>
      unit(
        Array.from({ length: 100 }, (_, wordIndex) => `large${unitIndex}x${wordIndex}`).join(" ") + ".",
        unitIndex + 1,
      ),
    );

    const first = buildSourceChunkPlan(units);
    const repeated = buildSourceChunkPlan(units);
    const coveredUnitIds = first.chunks.flatMap((chunk) =>
      chunk.spans.map((span) => span.sourceUnitId),
    );

    expect(first.readableWordCount).toBe(50000);
    expect(first.chunkCount).toBeGreaterThanOrEqual(34);
    expect(first.chunkCount).toBeLessThanOrEqual(50);
    expect(first.chunks.every((chunk) => chunk.wordCount > 0 && chunk.wordCount <= 1500)).toBe(true);
    expect(new Set(first.chunks.map((chunk) => chunk.chunkId)).size).toBe(first.chunkCount);
    expect(first.chunks.map((chunk) => chunk.chunkId)).toEqual(
      repeated.chunks.map((chunk) => chunk.chunkId),
    );
    expect(coveredUnitIds).toHaveLength(500);
    expect(new Set(coveredUnitIds).size).toBe(500);
    expect(first.chunks.slice(1, -1).every((chunk) =>
      chunk.contextBefore.length > 0 && chunk.contextAfter.length > 0,
    )).toBe(true);
    expect(first.reconciliation).toEqual({
      readableUnitsAccountedFor: 500,
      readableWordsAccountedFor: 50000,
      untrackedReadableUnits: 0,
      untrackedReadableWords: 0,
    });
  });

  test("an oversized paragraph splits at sentence and word boundaries", () => {
    const text = Array.from({ length: 3200 }, (_, index) => `token${index}`).join(" ") + ".";
    const plan = buildSourceChunkPlan([unit(text, 1)]);
    expect(plan.chunks.map((chunk) => chunk.wordCount)).toEqual([1500, 1500, 200]);
    expect(plan.chunks.every((chunk) => chunk.spans.every((span) => span.endOffset > span.startOffset))).toBe(true);
    expect(plan.reconciliation.untrackedReadableWords).toBe(0);
  });
});
