import type { CleanMarker, ImportPreviewRow } from "../types";
import { mapImportPreviewRowToCleanMarker } from "../import-pipeline";

export function mapPreviewRowToCleanMarker(row: ImportPreviewRow): Partial<CleanMarker> {
  return mapImportPreviewRowToCleanMarker(row);
}
