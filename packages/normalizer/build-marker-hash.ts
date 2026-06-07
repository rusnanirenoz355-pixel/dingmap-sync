import { createHash } from "node:crypto";
import type { CleanMarker } from "@dingmap-sync/shared";

const HASH_FIELDS: Array<keyof CleanMarker> = [
  "siteName",
  "address",
  "stationManager",
  "phone",
  "salary",
  "welfare",
  "interviewTime",
  "jobTitle",
  "remark",
];

export function buildMarkerHash(marker: Partial<CleanMarker>): string {
  const payload = HASH_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
    acc[field] = marker[field] ?? null;
    return acc;
  }, {});

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
