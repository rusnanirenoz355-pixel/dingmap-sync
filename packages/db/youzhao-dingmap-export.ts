import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { CleanMarker } from "@dingmap-sync/shared";
import { writeDingmapOneClickExport } from "@dingmap-sync/dingmap/one-click-export";
import {
  mapBusinessLineToDingmapLayer,
  type DingmapTargetLayer,
} from "@dingmap-sync/sources/youzhao";
import { resolveDatabasePath } from "./database-url";

export interface YouzhaoDingmapExportOptions {
  city: unknown;
  outputDir?: string;
  batchSize?: number;
}

export interface YouzhaoDingmapExportGroup {
  targetLayer: DingmapTargetLayer;
  rowCount: number;
  files: string[];
}

export interface YouzhaoDingmapExportResult {
  city: string;
  totalRows: number;
  groups: YouzhaoDingmapExportGroup[];
}

type CleanMarkerDbRow = {
  id: number;
  source: string;
  source_id: string | null;
  site_name: string;
  address: string;
  longitude: number | null;
  latitude: number | null;
  station_manager: string | null;
  phone: string | null;
  salary: string | null;
  welfare: string | null;
  interview_time: string | null;
  job_title: string | null;
  remark: string | null;
  origin_type: CleanMarker["originType"];
  dingmap_marker_id: string | null;
  sync_action: CleanMarker["syncAction"];
  sync_status: CleanMarker["syncStatus"];
  current_hash: string | null;
  last_synced_hash: string | null;
  locked_fields: string | null;
  merge_key: string | null;
  manual_override: number;
  error_msg: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type YouzhaoRawMetadata = {
  city: string;
  businessLine: string;
};

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_EXPORT_DIR = join(PROJECT_ROOT, "data", "exports");
const DEFAULT_BATCH_SIZE = 2000;
const TARGET_LAYERS: DingmapTargetLayer[] = ["美团点", "淘宝点", "买菜点", "其他点", "商超点"];

export async function exportYouzhaoDingmapTemplates(
  options: YouzhaoDingmapExportOptions,
): Promise<YouzhaoDingmapExportResult> {
  const city = normalizeExportCity(options.city);
  const outputDir = options.outputDir ?? DEFAULT_EXPORT_DIR;
  const batchSize = normalizeBatchSize(options.batchSize);
  const database = new DatabaseSync(resolveDatabasePath());

  try {
    const metadataBySourceId = loadYouzhaoRawMetadata(database);
    const candidates = listYouzhaoCleanMarkers(database)
      .map((marker) => ({
        marker,
        metadata: marker.sourceId ? metadataBySourceId.get(marker.sourceId) : undefined,
      }))
      .filter((entry): entry is { marker: CleanMarker; metadata: YouzhaoRawMetadata } =>
        entry.metadata?.city === city,
      )
      .sort(compareYouzhaoExportEntries);

    mkdirSync(outputDir, { recursive: true });
    const groups: YouzhaoDingmapExportGroup[] = [];

    for (const layer of TARGET_LAYERS) {
      const layerMarkers = candidates
        .filter((entry) => mapBusinessLineToDingmapLayer(entry.metadata.businessLine) === layer)
        .map((entry) => forceYouzhaoDingmapCoordinatesEmpty(entry.marker));
      if (layerMarkers.length === 0) {
        continue;
      }

      const files: string[] = [];
      const batches = chunk(layerMarkers, batchSize);
      const preferredFilenames = buildYouzhaoBatchFilenames({
        city,
        targetLayer: layer,
        rowCount: layerMarkers.length,
        batchSize,
      });
      for (const [batchIndex, batch] of batches.entries()) {
        const filename = resolveUniqueFilename(
          outputDir,
          preferredFilenames[batchIndex] ?? buildYouzhaoExportFilename({ city, targetLayer: layer }),
        );
        await writeDingmapOneClickExport(batch, join(outputDir, filename));
        files.push(filename);
      }

      groups.push({
        targetLayer: layer,
        rowCount: layerMarkers.length,
        files,
      });
    }

    return {
      city,
      totalRows: candidates.length,
      groups,
    };
  } finally {
    database.close();
  }
}

export function buildYouzhaoExportFilename(input: {
  city: string;
  targetLayer: DingmapTargetLayer;
  batchNumber?: number | null;
}): string {
  const city = sanitizeFilenamePart(input.city) || "未命名城市";
  const targetLayer = sanitizeFilenamePart(input.targetLayer);
  const batchSuffix = input.batchNumber ? `-第${input.batchNumber}批` : "";
  return `优招-${city}-${targetLayer}${batchSuffix}.xlsx`;
}

export function buildYouzhaoBatchFilenames(input: {
  city: string;
  targetLayer: DingmapTargetLayer;
  rowCount: number;
  batchSize?: number;
}): string[] {
  const batchSize = normalizeBatchSize(input.batchSize);
  const batchCount = Math.ceil(input.rowCount / batchSize);
  return Array.from({ length: batchCount }, (_, index) =>
    buildYouzhaoExportFilename({
      city: input.city,
      targetLayer: input.targetLayer,
      batchNumber: batchCount > 1 ? index + 1 : null,
    }),
  );
}

function normalizeExportCity(value: unknown): string {
  if (Array.isArray(value)) {
    throw new Error("一次只能导出一个城市。");
  }
  const city = typeof value === "string" ? value.trim() : "";
  if (!city) {
    throw new Error("必须选择一个城市。");
  }
  if (city.includes(",") || city.includes("，") || city === "全国" || city === "全国全部") {
    throw new Error("一次只能导出一个城市。");
  }
  return city;
}

function normalizeBatchSize(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_BATCH_SIZE;
  }
  if (!Number.isInteger(value) || value < 1 || value > DEFAULT_BATCH_SIZE) {
    throw new Error("batchSize 必须在 1 到 2000 之间。");
  }
  return value;
}

function listYouzhaoCleanMarkers(database: DatabaseSync): CleanMarker[] {
  const rows = database
    .prepare(
      `
        SELECT *
        FROM clean_markers
        WHERE source = 'youzhao'
          AND origin_type = 'web'
          AND deleted_at IS NULL
        ORDER BY source_id ASC, id ASC
      `,
    )
    .all() as CleanMarkerDbRow[];
  return rows.map(mapCleanMarkerRow);
}

function loadYouzhaoRawMetadata(database: DatabaseSync): Map<string, YouzhaoRawMetadata> {
  const rows = database
    .prepare(
      `
        SELECT raw_json
        FROM raw_records
        WHERE source = 'youzhao'
        ORDER BY id ASC
      `,
    )
    .all() as Array<{ raw_json: string }>;
  const metadata = new Map<string, YouzhaoRawMetadata>();

  for (const row of rows) {
    const parsed = parseRawRecord(row.raw_json);
    const sourceId = normalizeText(parsed.mapped?.sourceId) || normalizeText(parsed.raw?.jobId);
    const city = normalizeText(parsed.raw?.city);
    const businessLine = normalizeText(parsed.raw?.businessLine) || normalizeText(parsed.raw?.["业务线"]);
    if (!sourceId || !city) {
      continue;
    }
    metadata.set(sourceId, { city, businessLine });
  }

  return metadata;
}

function parseRawRecord(rawJson: string): {
  raw?: Record<string, unknown>;
  mapped?: Record<string, unknown>;
} {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }
    return {
      raw: isRecord(parsed.raw) ? parsed.raw : undefined,
      mapped: isRecord(parsed.mapped) ? parsed.mapped : undefined,
    };
  } catch {
    return {};
  }
}

function forceYouzhaoDingmapCoordinatesEmpty(marker: CleanMarker): CleanMarker {
  return {
    ...marker,
    longitude: null,
    latitude: null,
  };
}

function compareYouzhaoExportEntries(
  a: { marker: CleanMarker },
  b: { marker: CleanMarker },
): number {
  const sourceCompare = String(a.marker.sourceId ?? "").localeCompare(String(b.marker.sourceId ?? ""));
  if (sourceCompare !== 0) {
    return sourceCompare;
  }
  return Number(a.marker.id ?? 0) - Number(b.marker.id ?? 0);
}

function resolveUniqueFilename(outputDir: string, filename: string): string {
  if (!existsSync(join(outputDir, filename))) {
    return filename;
  }

  const basename = filename.slice(0, -".xlsx".length);
  let index = 2;
  let candidate = `${basename}-${index}.xlsx`;
  while (existsSync(join(outputDir, candidate))) {
    index += 1;
    candidate = `${basename}-${index}.xlsx`;
  }
  return candidate;
}

function sanitizeFilenamePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ");
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function mapCleanMarkerRow(row: CleanMarkerDbRow): CleanMarker {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.source_id,
    siteName: row.site_name,
    address: row.address,
    longitude: row.longitude,
    latitude: row.latitude,
    stationManager: row.station_manager,
    phone: row.phone,
    salary: row.salary,
    welfare: row.welfare,
    interviewTime: row.interview_time,
    jobTitle: row.job_title,
    remark: row.remark,
    originType: row.origin_type,
    dingmapMarkerId: row.dingmap_marker_id,
    syncAction: row.sync_action,
    syncStatus: row.sync_status,
    currentHash: row.current_hash,
    lastSyncedHash: row.last_synced_hash,
    lockedFields: parseLockedFields(row.locked_fields),
    mergeKey: row.merge_key,
    manualOverride: row.manual_override === 1,
    errorMsg: row.error_msg,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseLockedFields(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
