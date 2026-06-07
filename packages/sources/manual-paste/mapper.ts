import type { CleanMarker, ImportPreviewRow } from "../types";

export function mapPreviewRowToCleanMarker(row: ImportPreviewRow): Partial<CleanMarker> {
  return {
    ...row.normalized,
    source: "manual_paste",
    originType: "manual_paste",
    syncAction: row.normalized.syncAction ?? "review",
    syncStatus: row.normalized.syncStatus ?? "need_confirm",
    manualOverride: true,
  };
}
