export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];

export function normalizeCefrLevel(value: unknown): CefrLevel | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return CEFR_LEVELS.includes(normalized as CefrLevel)
    ? (normalized as CefrLevel)
    : null;
}

export function cefrRange(values: unknown): string | null {
  const levels = Array.isArray(values) ? values : [];
  const ranks = levels
    .map(normalizeCefrLevel)
    .filter((level): level is CefrLevel => level !== null)
    .map((level) => CEFR_LEVELS.indexOf(level));

  if (!ranks.length) return null;
  const lowest = CEFR_LEVELS[Math.min(...ranks)];
  const highest = CEFR_LEVELS[Math.max(...ranks)];
  return lowest === highest ? lowest : `${lowest}\u2013${highest}`;
}

export function buildNavigation(
  rows: Array<{ id: string }>,
  currentId: string,
) {
  const index = rows.findIndex((row) => row.id === currentId);
  if (index < 0) return null;

  return {
    previous_id: index > 0 ? rows[index - 1].id : null,
    next_id: index < rows.length - 1 ? rows[index + 1].id : null,
    position: index + 1,
    total: rows.length,
  };
}
