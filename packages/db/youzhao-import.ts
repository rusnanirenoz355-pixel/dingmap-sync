import type { ImportPreviewRow } from "@dingmap-sync/shared";
import type {
  DingmapTargetLayer,
  YouzhaoQueryInput,
  YouzhaoPreviewResult,
} from "@dingmap-sync/sources/youzhao";
import { previewYouzhaoPositions } from "@dingmap-sync/sources/youzhao";
import {
  importCleanMarkers,
  type ImportCleanMarkersResult,
} from "./import-clean-markers";

export interface YouzhaoImportOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface YouzhaoPreviewForImportResult extends YouzhaoPreviewResult {
  targetLayerCounts: Partial<Record<DingmapTargetLayer, number>>;
}

export interface YouzhaoImportResult
  extends YouzhaoPreviewForImportResult,
    ImportCleanMarkersResult {}

export async function previewYouzhaoPositionsForImport(
  input: YouzhaoQueryInput,
  options: YouzhaoImportOptions = {},
): Promise<YouzhaoPreviewForImportResult> {
  const result = await previewYouzhaoPositions(input, options);
  return {
    ...result,
    targetLayerCounts: countTargetLayers(result.rows),
  };
}

export async function importYouzhaoPositions(
  input: YouzhaoQueryInput,
  options: YouzhaoImportOptions = {},
): Promise<YouzhaoImportResult> {
  const preview = await previewYouzhaoPositionsForImport(input, options);

  if (preview.status !== "success") {
    return {
      ...preview,
      inserted: 0,
      updated: 0,
      skippedDuplicate: 0,
      skippedInvalid: 0,
      skippedOther: preview.rawRows.length,
      updateCandidate: 0,
      cleanMarkers: [],
    };
  }

  const importResult = importCleanMarkers(preview.rawRows);
  return {
    ...preview,
    ...importResult,
  };
}

function countTargetLayers(
  rows: ImportPreviewRow[],
): Partial<Record<DingmapTargetLayer, number>> {
  return rows.reduce<Partial<Record<DingmapTargetLayer, number>>>((counts, row) => {
    const layer = row.targetLayer as DingmapTargetLayer | null | undefined;
    if (layer) {
      counts[layer] = (counts[layer] ?? 0) + 1;
    }
    return counts;
  }, {});
}
