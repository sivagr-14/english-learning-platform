import {
  GEMINI_BATCH_THRESHOLD,
  reconcileGeminiBatchResults,
  resolveGenerationExecutionMode,
} from "./gemini-batch.service";

describe("Gemini Batch execution policy", () => {
  test("uses Standard for 1-20 and Batch for 21+ in auto mode", () => {
    expect(GEMINI_BATCH_THRESHOLD).toBe(20);
    expect(resolveGenerationExecutionMode("auto", 1)).toBe("standard");
    expect(resolveGenerationExecutionMode("auto", 20)).toBe("standard");
    expect(resolveGenerationExecutionMode("auto", 21)).toBe("batch");
  });
  test("honours an explicit pre-generation override", () => {
    expect(resolveGenerationExecutionMode("batch", 1)).toBe("batch");
    expect(resolveGenerationExecutionMode("standard", 500)).toBe("standard");
  });
  test("reconciles partial unordered results by immutable candidate ID", () => {
    const result = reconcileGeminiBatchResults(
      ["candidate-a", "candidate-b", "candidate-c"],
      [
        { candidateId: "candidate-c", response: { candidates: [] } },
        { candidateId: "candidate-a", error: { message: "temporary" } },
      ],
    );
    expect(result.succeeded.map((item) => item.candidateId)).toEqual(["candidate-c"]);
    expect(result.failed.map((item) => item.candidateId)).toEqual(["candidate-a"]);
    expect(result.missingCandidateIds).toEqual(["candidate-b"]);
  });
  test("rejects unexpected and duplicate result identities", () => {
    expect(() => reconcileGeminiBatchResults(["a"], [{ candidateId: "b" }])).toThrow("Unexpected");
    expect(() => reconcileGeminiBatchResults(["a"], [{ candidateId: "a" }, { candidateId: "a" }])).toThrow("Duplicate");
  });
});
