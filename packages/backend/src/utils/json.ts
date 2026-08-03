/**
 * Safely parses a value that may already be a parsed object (pg driver with
 * jsonb) or a raw JSON string (some test configs / older driver versions).
 * Returns `fallback` on null, undefined, or parse failure.
 */
export function readJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
