import { existsSync, mkdirSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type { CleanMarker } from "@dingmap-sync/shared";
import {
  buildDingmapExportFilename,
  writeDingmapOneClickExport,
} from "@dingmap-sync/dingmap/one-click-export";
import { DINGMAP_IMPORT_HEADERS } from "@dingmap-sync/dingmap/export-template";
import { resolveDatabasePath } from "./database-url";

export interface DingmapExportOptions {
  now?: Date;
  outputDir?: string;
  platformLabel?: string;
  exportName?: string;
}

export interface DingmapExportResult {
  runId: string;
  filename: string;
  filePath: string;
  downloadUrl: string;
  exportedCount: number;
  skippedCount: number;
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

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const DEFAULT_EXPORT_DIR = join(PROJECT_ROOT, "data", "exports");

export interface DingmapExportFile {
  filename: string;
  filePath: string;
  mtimeMs: number;
}

export async function exportDingmapOneClickTemplate(
  options: DingmapExportOptions = {},
): Promise<DingmapExportResult> {
  const now = options.now ?? new Date();
  const outputDir = options.outputDir ?? DEFAULT_EXPORT_DIR;
  const filename = buildDingmapExportFilename(now, {
    platformLabel: options.platformLabel,
    exportName: options.exportName,
  });
  const filePath = join(outputDir, filename);
  const runId = buildRunId(now);
  const database = new DatabaseSync(resolveDatabasePath());

  try {
    const allMarkers = listExportCandidateMarkers(database);
    const exportableMarkers = filterExportableMarkers(allMarkers);
    const skippedCount = allMarkers.length - exportableMarkers.length;

    if (exportableMarkers.length === 0) {
      throw new Error("没有可导出的 Clean Table 记录。");
    }

    mkdirSync(outputDir, { recursive: true });
    await writeDingmapOneClickExport(exportableMarkers, filePath);

    database.exec("BEGIN");
    try {
      for (const marker of exportableMarkers) {
        writeSyncPlan(database, runId, marker);
        writeSyncLog(database, runId, marker, filename);
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    return {
      runId,
      filename,
      filePath,
      downloadUrl: `/api/dingmap/download/${encodeURIComponent(filename)}`,
      exportedCount: exportableMarkers.length,
      skippedCount,
    };
  } catch (error) {
    writeFailureLog(database, runId, error);
    throw error;
  } finally {
    database.close();
  }
}

export function filterExportableMarkers(markers: CleanMarker[]): CleanMarker[] {
  return markers.filter((marker) => {
    const hasNameOrAddress = Boolean(marker.siteName.trim() || marker.address.trim());
    return (
      hasNameOrAddress &&
      !marker.deletedAt &&
      marker.syncStatus === "pending" &&
      (marker.syncAction === "create" || marker.syncAction === "update")
    );
  });
}

export function isSafeDingmapExportFilename(filename: string): boolean {
  return /^dingmap-import-(?:[^\\/:*?"<>|\r\n]+-)?\d{8}-\d{6}\.xlsx$/.test(filename);
}

export function resolveDingmapExportFilePath(
  filename: string,
  outputDir = DEFAULT_EXPORT_DIR,
): string {
  const safeBasename = basename(filename);
  if (safeBasename !== filename || !isSafeDingmapExportFilename(safeBasename)) {
    throw new Error("导出文件名无效。");
  }

  const exportDir = resolve(outputDir);
  const filePath = resolve(exportDir, safeBasename);
  assertPathInsideDirectory(filePath, exportDir);

  return filePath;
}

export function resolveExistingDingmapExportFilePath(
  filename: string,
  outputDir = DEFAULT_EXPORT_DIR,
): string {
  const filePath = resolveDingmapExportFilePath(filename, outputDir);
  if (!existsSync(filePath)) {
    throw new Error("导出文件不存在。");
  }

  const exportDir = resolve(outputDir);
  const realExportDir = realpathSync(exportDir);
  const realFilePath = realpathSync(filePath);
  assertPathInsideDirectory(realFilePath, realExportDir);

  return realFilePath;
}

export function listDingmapExportFiles(outputDir = DEFAULT_EXPORT_DIR): DingmapExportFile[] {
  const exportDir = resolve(outputDir);
  if (!existsSync(exportDir)) {
    return [];
  }

  const realExportDir = realpathSync(exportDir);
  return readdirSync(realExportDir)
    .filter(isSafeDingmapExportFilename)
    .map((filename) => {
      const filePath = resolveExistingDingmapExportFilePath(filename, realExportDir);
      return {
        filename,
        filePath,
        mtimeMs: statSync(filePath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);
}

export function selectLatestDingmapExportFile(
  outputDir = DEFAULT_EXPORT_DIR,
): DingmapExportFile | null {
  return listDingmapExportFiles(outputDir)[0] ?? null;
}

function assertPathInsideDirectory(filePath: string, directoryPath: string): void {
  const relation = relative(directoryPath, filePath);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("导出文件必须位于 data/exports 目录。");
  }
}

function listExportCandidateMarkers(database: DatabaseSync): CleanMarker[] {
  const rows = database
    .prepare(
      `
        SELECT *
        FROM clean_markers
        WHERE sync_status = 'pending'
          AND sync_action IN ('create', 'update')
          AND deleted_at IS NULL
        ORDER BY updated_at DESC, id DESC
      `,
    )
    .all() as CleanMarkerDbRow[];

  return rows.map(mapCleanMarkerRow);
}

function writeSyncPlan(database: DatabaseSync, runId: string, marker: CleanMarker): void {
  database
    .prepare(
      `
        INSERT INTO sync_plan (
          run_id,
          clean_marker_id,
          source,
          source_id,
          action,
          reason,
          before_hash,
          after_hash,
          status,
          finished_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
    )
    .run(
      runId,
      marker.id ?? 0,
      marker.source,
      marker.sourceId ?? null,
      "export",
      "dingmap_one_click_template",
      marker.lastSyncedHash ?? null,
      marker.currentHash ?? null,
      "synced",
    );
}

function writeSyncLog(
  database: DatabaseSync,
  runId: string,
  marker: CleanMarker,
  filename: string,
): void {
  database
    .prepare(
      `
        INSERT INTO sync_logs (
          run_id,
          source,
          source_id,
          action,
          after_json,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      runId,
      marker.source,
      marker.sourceId ?? null,
      "export",
      JSON.stringify({
        cleanMarkerId: marker.id,
        source: marker.source,
        sourceId: marker.sourceId,
        filename,
        fields: DINGMAP_IMPORT_HEADERS,
      }),
      "success",
    );
}

function writeFailureLog(database: DatabaseSync, runId: string, error: unknown): void {
  database
    .prepare(
      `
        INSERT INTO sync_logs (
          run_id,
          source,
          action,
          status,
          error_msg
        )
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .run(runId, "dingmap", "export", "failed", getErrorMessage(error));
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

function buildRunId(now: Date): string {
  return `dingmap-export-${now.getTime()}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
