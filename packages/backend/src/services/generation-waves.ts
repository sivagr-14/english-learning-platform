export interface PlannedBatch {
  batchNumber: number;
  candidateIds: readonly string[];
}

export interface GenerationWave {
  waveNumber: number;
  totalWaves: number;
  firstBatchNumber: number;
  lastBatchNumber: number;
  batchNumbers: number[];
  candidateCount: number;
  remainingBatchNumbers: number[];
  complete: boolean;
}

/**
 * Adds a deterministic, user-visible execution layer without changing the
 * immutable content-pack manifest or its retry-safe internal batches.
 */
export function planGenerationWaves(
  batches: readonly PlannedBatch[],
  receivedBatchNumbers: ReadonlySet<number> = new Set(),
  maximumWaves = 5,
): GenerationWave[] {
  if (!Number.isInteger(maximumWaves) || maximumWaves < 1 || maximumWaves > 5)
    throw new Error("maximumWaves must be an integer from 1 to 5.");
  if (batches.length === 0) return [];

  const ordered = [...batches].sort((a, b) => a.batchNumber - b.batchNumber);
  if (new Set(ordered.map((batch) => batch.batchNumber)).size !== ordered.length)
    throw new Error("Generation plan contains duplicate batch numbers.");

  const totalWaves = Math.min(maximumWaves, ordered.length);
  return Array.from({ length: totalWaves }, (_, index) => {
    const start = Math.floor((index * ordered.length) / totalWaves);
    const end = Math.floor(((index + 1) * ordered.length) / totalWaves);
    const members = ordered.slice(start, end);
    const batchNumbers = members.map((batch) => batch.batchNumber);
    const remainingBatchNumbers = batchNumbers.filter(
      (batchNumber) => !receivedBatchNumbers.has(batchNumber),
    );
    return {
      waveNumber: index + 1,
      totalWaves,
      firstBatchNumber: batchNumbers[0],
      lastBatchNumber: batchNumbers[batchNumbers.length - 1],
      batchNumbers,
      candidateCount: members.reduce(
        (sum, batch) => sum + batch.candidateIds.length,
        0,
      ),
      remainingBatchNumbers,
      complete: remainingBatchNumbers.length === 0,
    };
  });
}

export function firstRemainingBatch(
  waves: readonly GenerationWave[],
): number | null {
  for (const wave of waves) {
    if (wave.remainingBatchNumbers.length > 0)
      return wave.remainingBatchNumbers[0];
  }
  return null;
}
