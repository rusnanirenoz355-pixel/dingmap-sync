export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim().replace(/\s+/g, " ");
}
