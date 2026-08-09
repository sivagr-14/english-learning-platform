import {
  aggregateGeminiUsage,
  calculateGeminiCost,
  evaluateContextCache,
  projectFromObservedAttempts,
  selectGeminiModel,
} from "./gemini-cost-optimization.service";

describe("Gemini Phase 6 cost optimization", () => {
  test("prices uncached, cached and thinking tokens for Standard and Batch", () => {
    const usage = { inputTokens: 1_000_000, cachedTokens: 500_000, outputTokens: 100_000, thinkingTokens: 50_000 };
    expect(calculateGeminiCost("gemini-2.5-flash", usage, "standard")).toBeCloseTo(0.54);
    expect(calculateGeminiCost("gemini-2.5-flash", usage, "batch")).toBeCloseTo(0.27);
  });

  test("prices Gemini 3.6 Flash without breaking connection tests or generation", () => {
    const usage = { inputTokens: 1_000_000, cachedTokens: 200_000, outputTokens: 100_000 };
    expect(calculateGeminiCost("gemini-3.6-flash", usage, "standard")).toBeCloseTo(1.98);
    expect(calculateGeminiCost("gemini-3.6-flash", usage, "batch")).toBeCloseTo(0.99);
  });

  test("aggregates retries instead of hiding their cost", () => {
    expect(aggregateGeminiUsage([
      { model: "gemini-2.5-flash", requestType: "assessment", inputTokens: 10, outputTokens: 20, cachedTokens: 3, thinkingTokens: 2, latencyMs: 100, costUsd: 0.01 },
      { model: "gemini-2.5-flash", requestType: "assessment", inputTokens: 11, outputTokens: 21, cachedTokens: 4, thinkingTokens: 1, latencyMs: 120, costUsd: 0.02 },
    ])).toEqual({ inputTokens: 21, outputTokens: 41, cachedTokens: 7, thinkingTokens: 3, latencyMs: 220, costUsd: 0.03, attempts: 2 });
  });

  test("uses observed averages for projections and reports the basis", () => {
    const projection = projectFromObservedAttempts([
      { model: "gemini-2.5-flash", requestType: "lesson_generation", inputTokens: 1000, outputTokens: 500, latencyMs: 20 },
      { model: "gemini-2.5-flash", requestType: "lesson_generation", inputTokens: 2000, outputTokens: 700, latencyMs: 30 },
    ], 10, { inputTokens: 3000, outputTokens: 2000 }, "gemini-2.5-flash", "standard");
    expect(projection.basis).toBe("observed");
    expect(projection.sampleSize).toBe(2);
    expect(projection.estimatedInputTokens).toBe(15000);
    expect(projection.estimatedOutputTokens).toBe(6000);
  });

  test("enables caching only when estimated savings exceed storage", () => {
    expect(evaluateContextCache({ model: "gemini-2.5-flash", reusableTokens: 100_000, expectedUses: 100, ttlHours: 1, storageUsdPerMillionTokenHour: 1 }).enabled).toBe(true);
    expect(evaluateContextCache({ model: "gemini-2.5-flash", reusableTokens: 100_000, expectedUses: 1, ttlHours: 24, storageUsdPerMillionTokenHour: 1 }).enabled).toBe(false);
  });

  test("never routes Flash-Lite without a passing benchmark gate", () => {
    expect(selectGeminiModel({ stage: "assessment", benchmarkGate: "blocked", flashLiteEnabled: true }).model).toBe("gemini-2.5-flash");
    expect(selectGeminiModel({ stage: "lesson", benchmarkGate: "passed", flashLiteEnabled: true }).model).toBe("gemini-2.5-flash");
    expect(selectGeminiModel({ stage: "assessment", benchmarkGate: "passed", flashLiteEnabled: true }).model).toBe("gemini-2.5-flash-lite");
  });
});
