import type { ImportPreviewRow } from "@dingmap-sync/shared";
import { parseManualPasteText } from "../sources/manual-paste/parser";
import {
  importCleanMarkers,
  listCleanMarkers,
  previewRawImportRows,
  type ImportCleanMarkersResult,
  type ImportPreviewResult,
  type PreviewSummary,
} from "./import-clean-markers";

export type { ImportCleanMarkersResult as ManualPasteImportResult, PreviewSummary };

export type ManualPastePreviewResult = ImportPreviewResult;

export function previewManualPaste(text: string): ManualPastePreviewResult {
  return previewRawImportRows(parseManualPasteText(text));
}

export function importManualPaste(rows: ImportPreviewRow[]): ImportCleanMarkersResult {
  return importCleanMarkers(rows);
}

export { listCleanMarkers };
