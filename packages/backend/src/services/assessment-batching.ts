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


export function balancedAssessmentGroups<T>(
  items: readonly T[],
  maximumGroupSize = 100,
): T[][] {
  if (!Number.isInteger(maximumGroupSize) || maximumGroupSize < 2) {
    throw new Error("maximumGroupSize must be an integer of at least 2.");
  }
  if (items.length === 0) return [];
  const groupCount = Math.ceil(items.length / maximumGroupSize);
  const baseSize = Math.floor(items.length / groupCount);
  const remainder = items.length % groupCount;
  const groups: T[][] = [];
  let offset = 0;
  for (let index = 0; index < groupCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    groups.push(items.slice(offset, offset + size));
    offset += size;
  }
  return groups;
}
