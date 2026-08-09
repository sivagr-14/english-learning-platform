export type GeminiExecutionMode = "standard" | "batch";
export type GeminiRequestType = "assessment" | "lesson_generation" | "lesson_generation_batch";

export const GEMINI_PRICING_VERSION = "2026-08-09-gemini-3.6";

export interface GeminiUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  thinkingTokens?: number;
}

interface Rates {
  input: number;
  cachedInput: number;
  output: number;
}

const STANDARD_RATES: Record<string, Rates> = {
  // Google Gemini API paid-tier text rates published for Gemini 3.6 Flash.
  // Batch/Flex are 50% of Standard, which calculateGeminiCost applies below.
  "gemini-3.6-flash": { input: 1.5, cachedInput: 0.15, output: 7.5 },
  "gemini-2.5-flash": { input: 0.3, cachedInput: 0.03, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, cachedInput: 0.01, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, cachedInput: 0.125, output: 10 },
};

function nonNegative(value: number | undefined): number {
  const result = Number(value ?? 0);
  if (!Number.isFinite(result) || result < 0) throw new Error("Token counts must be finite non-negative numbers.");
  return result;
}

export function calculateGeminiCost(
  model: string,
  usage: GeminiUsage,
  mode: GeminiExecutionMode = "standard",
): number {
  const rates = STANDARD_RATES[model];
  if (!rates) throw new Error(`No approved Gemini pricing is configured for ${model}.`);
  const input = nonNegative(usage.inputTokens);
  const cached = Math.min(input, nonNegative(usage.cachedTokens));
  const output = nonNegative(usage.outputTokens) + nonNegative(usage.thinkingTokens);
  const discount = mode === "batch" ? 0.5 : 1;
  return (((input - cached) * rates.input + cached * rates.cachedInput + output * rates.output) / 1_000_000) * discount;
}

export interface AttemptUsage extends GeminiUsage {
  model: string;
  requestType: string;
  latencyMs: number;
  costUsd?: number;
}

export function aggregateGeminiUsage(attempts: AttemptUsage[]) {
  return attempts.reduce(
    (total, attempt) => ({
      inputTokens: total.inputTokens + nonNegative(attempt.inputTokens),
      outputTokens: total.outputTokens + nonNegative(attempt.outputTokens),
      cachedTokens: total.cachedTokens + nonNegative(attempt.cachedTokens),
      thinkingTokens: total.thinkingTokens + nonNegative(attempt.thinkingTokens),
      latencyMs: total.latencyMs + nonNegative(attempt.latencyMs),
      costUsd: total.costUsd + nonNegative(attempt.costUsd),
      attempts: total.attempts + 1,
    }),
    { inputTokens: 0, outputTokens: 0, cachedTokens: 0, thinkingTokens: 0, latencyMs: 0, costUsd: 0, attempts: 0 },
  );
}

export function projectFromObservedAttempts(
  attempts: AttemptUsage[],
  remainingRequests: number,
  fallback: { inputTokens: number; outputTokens: number },
  model: string,
  mode: GeminiExecutionMode,
) {
  if (!Number.isInteger(remainingRequests) || remainingRequests < 0) throw new Error("Remaining requests must be a non-negative integer.");
  const observed = attempts.length
    ? {
        inputTokens: attempts.reduce((sum, item) => sum + item.inputTokens, 0) / attempts.length,
        outputTokens: attempts.reduce((sum, item) => sum + item.outputTokens, 0) / attempts.length,
        cachedTokens: attempts.reduce((sum, item) => sum + (item.cachedTokens ?? 0), 0) / attempts.length,
        thinkingTokens: attempts.reduce((sum, item) => sum + (item.thinkingTokens ?? 0), 0) / attempts.length,
      }
    : { ...fallback, cachedTokens: 0, thinkingTokens: 0 };
  return {
    basis: attempts.length ? "observed" as const : "fallback" as const,
    sampleSize: attempts.length,
    remainingRequests,
    estimatedInputTokens: Math.round(observed.inputTokens * remainingRequests),
    estimatedOutputTokens: Math.round(observed.outputTokens * remainingRequests),
    estimatedCostUsd: calculateGeminiCost(model, {
      inputTokens: observed.inputTokens * remainingRequests,
      outputTokens: observed.outputTokens * remainingRequests,
      cachedTokens: observed.cachedTokens * remainingRequests,
      thinkingTokens: observed.thinkingTokens * remainingRequests,
    }, mode),
  };
}

export function evaluateContextCache(input: {
  model: string;
  reusableTokens: number;
  expectedUses: number;
  ttlHours: number;
  storageUsdPerMillionTokenHour: number;
}) {
  const rates = STANDARD_RATES[input.model];
  if (!rates) throw new Error(`No approved Gemini pricing is configured for ${input.model}.`);
  const reusable = nonNegative(input.reusableTokens);
  const uses = nonNegative(input.expectedUses);
  const storage = (reusable / 1_000_000) * nonNegative(input.ttlHours) * nonNegative(input.storageUsdPerMillionTokenHour);
  const savings = (reusable / 1_000_000) * uses * (rates.input - rates.cachedInput);
  return { enabled: savings > storage, estimatedSavingsUsd: Math.max(0, savings - storage), storageCostUsd: storage };
}

export function selectGeminiModel(input: {
  stage: "assessment" | "sense_resolution" | "lesson";
  benchmarkGate: "passed" | "failed" | "blocked";
  flashLiteEnabled: boolean;
}) {
  const eligible = input.stage === "assessment" && input.benchmarkGate === "passed" && input.flashLiteEnabled;
  return {
    model: eligible ? "gemini-2.5-flash-lite" : "gemini-2.5-flash",
    reason: eligible ? "benchmark-approved-low-risk-stage" : "quality-baseline",
  };
}
