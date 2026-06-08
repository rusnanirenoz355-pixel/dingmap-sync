import type { CleanMarker } from "@dingmap-sync/shared";

export type ImportPreviewSource = "manual_paste" | "excel";

export interface RawImportRow {
  rowIndex: number;
  source: ImportPreviewSource;
  originType: Extract<CleanMarker["originType"], "manual_paste" | "excel">;
  rawText: string;
  raw: Record<string, string>;
}

export interface ExistingMarkerFingerprint {
  id: number;
  currentHash: string | null;
}
