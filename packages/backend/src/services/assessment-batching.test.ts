import {
  assessmentBatchConfig,
  assessmentGroups,
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
