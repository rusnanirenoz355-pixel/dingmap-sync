import type { CleanMarker, ImportPreviewRow } from "../types";

export function mapPreviewRowToCleanMarker(row: ImportPreviewRow): Partial<CleanMarker> {
  return {
    ...row.mapped,
    source: "manual_paste",
    originType: "manual_paste",
    syncAction: row.status === "update_candidate" ? "update" : "create",
    syncStatus: "pending",
    currentHash: row.currentHash,
    mergeKey: row.mergeKey,
    lockedFields: [],
    manualOverride: true,
  };
}
