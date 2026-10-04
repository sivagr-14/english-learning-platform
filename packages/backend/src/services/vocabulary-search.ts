export const SEARCH_MODES = [
  "all",
  "contains",
  "prefix",
  "suffix",
  "tokens",
  "exact",
] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

/** User input is literal text, never an SQL LIKE wildcard expression. */
export function escapeSearchPattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function wordSearchPatterns(term: string, mode: SearchMode): string[] {
  const escaped = escapeSearchPattern(term);
  if (mode === "exact") return [escaped];
  if (mode === "prefix") return [`${escaped}%`];
  if (mode === "suffix") return [`%${escaped}`];
  if (mode === "tokens")
    return [...new Set(term.split(/\s+/).filter(Boolean))].map(
      (token) => `%${escapeSearchPattern(token)}%`,
    );
  return [`%${escaped}%`];
}
