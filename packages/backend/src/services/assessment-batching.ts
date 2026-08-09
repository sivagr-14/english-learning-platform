export function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function assessmentBatchConfig(
  provider: "gemini" | "ollama",
  environment: NodeJS.ProcessEnv = process.env,
): { batchSize: number; timeoutMs?: number } {
  if (provider === "gemini") return { batchSize: 50 };
  return {
    batchSize: positiveInteger(environment.OLLAMA_ASSESSMENT_BATCH_SIZE, 8),
    timeoutMs: Math.max(
      10_000,
      positiveInteger(environment.OLLAMA_ASSESSMENT_TIMEOUT_MS, 180_000),
    ),
  };
}

export function assessmentGroups<T>(items: T[], batchSize: number): T[][] {
  const groups: T[][] = [];
  for (let offset = 0; offset < items.length; offset += batchSize) {
    groups.push(items.slice(offset, offset + batchSize));
  }
  return groups;
}
