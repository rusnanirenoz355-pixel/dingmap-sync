export function normalizePhone(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/[^\d+]/g, "");
}
