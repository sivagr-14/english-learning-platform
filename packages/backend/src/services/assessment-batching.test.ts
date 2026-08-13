import {
  assessmentBatchConfig,
  assessmentGroups,
  balancedAssessmentGroups,
} from "./assessment-batching";

describe("assessment batching", () => {
  it("keeps cloud assessment within the policy group of 50", () => {
    expect(assessmentBatchConfig("gemini")).toEqual({ batchSize: 50 });
  });

  it("uses small configurable Ollama groups and a bounded timeout", () => {
    expect(assessmentBatchConfig("ollama", {})).toEqual({
      batchSize: 8,
      timeoutMs: 180_000,
    });
    expect(assessmentBatchConfig("ollama", {
      OLLAMA_ASSESSMENT_BATCH_SIZE: "4",
      OLLAMA_ASSESSMENT_TIMEOUT_MS: "5000",
    })).toEqual({ batchSize: 4, timeoutMs: 10_000 });
  });

  it("partitions every candidate exactly once", () => {
    expect(assessmentGroups([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });
});


describe("balanced adaptive assessment groups", () => {
  it.each([
    [1, [1]],
    [50, [50]],
    [100, [100]],
    [101, [51, 50]],
    [199, [100, 99]],
    [200, [100, 100]],
    [201, [67, 67, 67]],
    [1064, [97, 97, 96, 96, 96, 96, 96, 96, 96, 96, 96]],
    [5063, Array.from({ length: 51 }, (_, index) => index < 14 ? 100 : 99)],
  ])("uses the fewest balanced groups for %i candidates", (count, expectedSizes) => {
    const items = Array.from({ length: count as number }, (_, index) => index);
    const groups = balancedAssessmentGroups(items);
    expect(groups.map((group) => group.length)).toEqual(expectedSizes);
    expect(groups.flat()).toEqual(items);
  });

  it("does not create an undersized tail above 100 candidates", () => {
    for (let count = 101; count <= 2_000; count += 1) {
      const sizes = balancedAssessmentGroups(
        Array.from({ length: count }, (_, index) => index),
      ).map((group) => group.length);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(100);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(50);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(sizes).toHaveLength(Math.ceil(count / 100));
    }
  });
});
