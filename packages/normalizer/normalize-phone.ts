export function normalizePhone(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/[^\d+]/g, "");
}

export interface PhoneNormalizationResult {
  raw: string;
  compact: string;
  phones: string[];
  primaryPhone: string;
  hasMultiple: boolean;
  isValid: boolean;
}

export function normalizePhoneForImport(value: unknown): PhoneNormalizationResult {
  const raw = value === null || value === undefined ? "" : String(value).trim();
  const compact = raw.replace(/[\s-]/g, "");
  const digitText = compact.replace(/[^\d]/g, "");
  const phones = Array.from(new Set(digitText.match(/1[3-9]\d{9}/g) ?? []));

  return {
    raw,
    compact,
    phones,
    primaryPhone: phones[0] ?? "",
    hasMultiple: phones.length > 1,
    isValid: raw.length === 0 || phones.length > 0,
  };
}
