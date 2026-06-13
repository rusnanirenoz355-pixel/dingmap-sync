import type { CleanMarker } from "@dingmap-sync/shared";

export type ImportSource = "manual_paste" | "excel" | "youzhao";
export type ImportPreviewSource = ImportSource;
export type ImportOriginType = Extract<CleanMarker["originType"], "manual_paste" | "excel" | "web">;

export interface RawImportRow {
  rowIndex: number;
  source: ImportSource;
  originType: ImportOriginType;
  sourceId?: string | null;
  rawText: string;
  raw: Record<string, string>;
}

export interface ExistingMarkerFingerprint {
  id: number;
  currentHash: string | null;
}
