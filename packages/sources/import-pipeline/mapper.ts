import type { CleanMarker, ImportPreviewRow } from "@dingmap-sync/shared";

export function mapImportPreviewRowToCleanMarker(row: ImportPreviewRow): Partial<CleanMarker> {
  return {
    ...row.mapped,
    source: row.mapped.source ?? row.source,
    originType: row.mapped.originType ?? "manual_paste",
    syncAction: row.status === "update_candidate" ? "update" : "create",
    syncStatus: "pending",
    currentHash: row.currentHash,
    mergeKey: row.mergeKey,
    lockedFields: [],
    manualOverride: true,
  };
}
