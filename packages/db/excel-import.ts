import {
  parseExcelImportWorkbook,
  type ExcelImportParseOptions,
  type ExcelImportPreviewResult,
} from "../sources/excel-import";
import type { RawImportRow } from "../sources/import-pipeline";
import {
  importCleanMarkers,
  previewRawImportRows,
  type ImportCleanMarkersResult,
} from "./import-clean-markers";

export async function previewExcelImportBuffer(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  options: ExcelImportParseOptions = {},
): Promise<ExcelImportPreviewResult> {
  const parsed = await parseExcelImportWorkbook(buffer, options);
  const preview = previewRawImportRows(parsed.rawRows);
  return {
    ...parsed,
    rows: preview.rows,
    summary: preview.summary,
  };
}

export function importExcelRows(rows: RawImportRow[]): ImportCleanMarkersResult {
  return importCleanMarkers(rows);
}
