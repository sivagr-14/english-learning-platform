import { firstRemainingBatch, planGenerationWaves } from "./generation-waves";

const batches = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    batchNumber: index + 1,
    candidateIds: [`candidate-${index + 1}`],
  }));

describe("generation wave planning", () => {
  it("overlays 135 immutable batches with five balanced contiguous waves", () => {
    const waves = planGenerationWaves(batches(135));
    expect(waves).toHaveLength(5);
    expect(waves.map((wave) => wave.batchNumbers.length)).toEqual([
      27, 27, 27, 27, 27,
    ]);
    expect(waves.flatMap((wave) => wave.batchNumbers)).toEqual(
      Array.from({ length: 135 }, (_, index) => index + 1),
    );
  });

  it("preserves completed receipts and resumes at the first missing batch", () => {
    const waves = planGenerationWaves(batches(135), new Set([1, 2]));
    expect(waves[0].remainingBatchNumbers[0]).toBe(3);
    expect(firstRemainingBatch(waves)).toBe(3);
  });

  it("uses one to five waves and rejects unsafe configuration", () => {
    expect(planGenerationWaves(batches(3))).toHaveLength(3);
    expect(planGenerationWaves([])).toEqual([]);
    expect(() => planGenerationWaves(batches(10), new Set(), 6)).toThrow(
      "maximumWaves",
    );
    expect(() =>
      planGenerationWaves([
        { batchNumber: 1, candidateIds: ["a"] },
        { batchNumber: 1, candidateIds: ["b"] },
      ]),
    ).toThrow("duplicate batch numbers");
  });

  it("groups eleven large generation cycles into five resumable waves", () => {
    const waves = planGenerationWaves(batches(11));
    expect(waves).toHaveLength(5);
    expect(waves.map((wave) => wave.batchNumbers.length)).toEqual([2, 2, 2, 2, 3]);
    expect(firstRemainingBatch(waves)).toBe(1);
  });
});
