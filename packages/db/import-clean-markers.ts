import { DatabaseSync } from "node:sqlite";
import type { CleanMarker, ImportPreviewRow } from "@dingmap-sync/shared";
import {
  buildImportPreview,
  mapImportPreviewRowToCleanMarker,
  summarizePreviewRows,
  type ExistingMarkerFingerprint,
  type PreviewSummary,
  type RawImportRow,
} from "../sources/import-pipeline";
import { resolveDatabasePath } from "./database-url";

export type { PreviewSummary };

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  summary: PreviewSummary;
}

export interface ImportCleanMarkersResult {
  inserted: number;
  updated: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  skippedOther: number;
  updateCandidate: number;
  cleanMarkers: CleanMarker[];
}

export interface ImportCleanMarkersOptions {
  updateCandidates?: "update" | "skip";
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

export function previewRawImportRows(rows: RawImportRow[]): ImportPreviewResult {
  const database = openDatabase();
  try {
    const existingMarkers = loadExistingMarkerFingerprints(database);
    const previewRows = buildImportPreview(rows, existingMarkers);
    return {
      rows: previewRows,
      summary: summarizePreviewRows(previewRows),
    };
  } finally {
    database.close();
  }
}

export function importCleanMarkers(
  rows: Array<RawImportRow | ImportPreviewRow>,
  options: ImportCleanMarkersOptions = {},
): ImportCleanMarkersResult {
  const database = openDatabase();
  const result: Omit<ImportCleanMarkersResult, "cleanMarkers"> = {
    inserted: 0,
    updated: 0,
    skippedDuplicate: 0,
    skippedInvalid: 0,
    skippedOther: 0,
    updateCandidate: 0,
  };

  try {
    database.exec("BEGIN");

    for (const incomingRow of rows) {
      const rawRow = extractRawImportRow(incomingRow);
      if (!rawRow) {
        result.skippedOther += 1;
        continue;
      }

      const existingMarkers = loadExistingMarkerFingerprints(database);
      const revalidated = buildImportPreview([rawRow], existingMarkers)[0];

      if (!revalidated) {
        result.skippedOther += 1;
        continue;
      }

      if (revalidated.status === "invalid") {
        result.skippedInvalid += 1;
        continue;
      }

      if (revalidated.status === "duplicate") {
        result.skippedDuplicate += 1;
        continue;
      }

      if (revalidated.status === "update_candidate") {
        result.updateCandidate += 1;
        if (options.updateCandidates === "skip") {
          continue;
        }
        writeRawRecord(database, revalidated);
        updateCleanMarker(database, revalidated);
        result.updated += 1;
        continue;
      }

      if (revalidated.status === "valid") {
        writeRawRecord(database, revalidated);
        insertCleanMarker(database, revalidated);
        result.inserted += 1;
        continue;
      }

      result.skippedOther += 1;
    }

    database.exec("COMMIT");
    return {
      ...result,
      cleanMarkers: listCleanMarkers(database),
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

export function listCleanMarkers(existingDatabase?: DatabaseSync): CleanMarker[] {
  const database = existingDatabase ?? openDatabase();
  try {
    const rows = database
      .prepare(
        `
          SELECT *
          FROM clean_markers
          WHERE deleted_at IS NULL
          ORDER BY updated_at DESC, id DESC
          LIMIT 200
        `,
      )
      .all() as CleanMarkerDbRow[];

    return rows.map(mapCleanMarkerRow);
  } finally {
    if (!existingDatabase) {
      database.close();
    }
  }
}

function openDatabase(): DatabaseSync {
  return new DatabaseSync(resolveDatabasePath());
}

function loadExistingMarkerFingerprints(
  database: DatabaseSync,
): Map<string, ExistingMarkerFingerprint> {
  const rows = database
    .prepare(
      `
        SELECT id, merge_key, current_hash
        FROM clean_markers
        WHERE merge_key IS NOT NULL AND merge_key != ''
          AND deleted_at IS NULL
      `,
    )
    .all() as Array<{ id: number; merge_key: string; current_hash: string | null }>;

  return new Map(
    rows.map((row) => [
      row.merge_key,
      {
        id: row.id,
        currentHash: row.current_hash,
      },
    ]),
  );
}

function extractRawImportRow(row: RawImportRow | ImportPreviewRow): RawImportRow | null {
  if (!isRecord(row.raw)) {
    return null;
  }

  const source = isImportSource(row.source) ? row.source : null;
  if (!source) {
    return null;
  }

  const previewOriginType = "mapped" in row ? row.mapped.originType : undefined;
  const originType =
    "originType" in row && isImportOrigin(row.originType)
      ? row.originType
      : isImportOrigin(previewOriginType)
        ? previewOriginType
        : defaultOriginTypeForSource(source);

  return {
    rowIndex: Number.isFinite(row.rowIndex) ? row.rowIndex : 0,
    source,
    originType,
    sourceId: "mapped" in row ? undefined : row.sourceId,
    rawText: typeof row.rawText === "string" ? row.rawText : "",
    raw: normalizeRawRecord(row.raw),
  };
}

function writeRawRecord(database: DatabaseSync, row: ImportPreviewRow): void {
  const marker = row.mapped;
  database
    .prepare(
      `
        INSERT INTO raw_records (
          source,
          source_id,
          raw_title,
          raw_address,
          raw_phone,
          raw_salary,
          raw_welfare,
          raw_manager,
          raw_json,
          parse_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      row.source,
      `${row.source}:${Date.now()}:${row.rowIndex}`,
      marker.siteName ?? null,
      marker.address ?? null,
      marker.phone ?? null,
      marker.salary ?? null,
      marker.welfare ?? null,
      marker.stationManager ?? null,
      JSON.stringify({
        rowIndex: row.rowIndex,
        source: row.source,
        raw: row.raw,
        mapped: row.mapped,
        status: row.status,
        warnings: row.warnings,
      }),
      row.status,
    );
}

function insertCleanMarker(database: DatabaseSync, row: ImportPreviewRow): void {
  const marker = mapImportPreviewRowToCleanMarker(row);
  database
    .prepare(
      `
        INSERT INTO clean_markers (
          source,
          source_id,
          site_name,
          address,
          longitude,
          latitude,
          station_manager,
          phone,
          salary,
          welfare,
          interview_time,
          job_title,
          remark,
          origin_type,
          sync_action,
          sync_status,
          current_hash,
          locked_fields,
          merge_key,
          manual_override,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
    )
    .run(
      marker.source ?? row.source,
      marker.sourceId ?? null,
      marker.siteName ?? "",
      marker.address ?? "",
      marker.longitude ?? null,
      marker.latitude ?? null,
      marker.stationManager ?? null,
      marker.phone ?? null,
      marker.salary ?? null,
      marker.welfare ?? null,
      marker.interviewTime ?? null,
      marker.jobTitle ?? null,
      marker.remark ?? null,
      marker.originType ?? "manual_paste",
      "create",
      "pending",
      marker.currentHash ?? null,
      JSON.stringify(marker.lockedFields ?? []),
      marker.mergeKey ?? null,
      marker.manualOverride ? 1 : 0,
    );
}

function updateCleanMarker(database: DatabaseSync, row: ImportPreviewRow): void {
  const marker = mapImportPreviewRowToCleanMarker(row);
  database
    .prepare(
      `
        UPDATE clean_markers
        SET
          source = ?,
          source_id = ?,
          site_name = ?,
          address = ?,
          longitude = ?,
          latitude = ?,
          station_manager = ?,
          phone = ?,
          salary = ?,
          welfare = ?,
          interview_time = ?,
          job_title = ?,
          remark = ?,
          origin_type = ?,
          sync_action = 'update',
          sync_status = 'pending',
          current_hash = ?,
          locked_fields = ?,
          manual_override = 1,
          error_msg = NULL,
          updated_at = datetime('now')
        WHERE merge_key = ?
      `,
    )
    .run(
      marker.source ?? row.source,
      marker.sourceId ?? null,
      marker.siteName ?? "",
      marker.address ?? "",
      marker.longitude ?? null,
      marker.latitude ?? null,
      marker.stationManager ?? null,
      marker.phone ?? null,
      marker.salary ?? null,
      marker.welfare ?? null,
      marker.interviewTime ?? null,
      marker.jobTitle ?? null,
      marker.remark ?? null,
      marker.originType ?? "manual_paste",
      marker.currentHash ?? null,
      JSON.stringify(marker.lockedFields ?? []),
      marker.mergeKey ?? null,
    );
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

function normalizeRawRecord(raw: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isImportSource(value: unknown): value is RawImportRow["source"] {
  return value === "manual_paste" || value === "excel" || value === "youzhao";
}

export function isImportOrigin(value: unknown): value is RawImportRow["originType"] {
  return value === "manual_paste" || value === "excel" || value === "web";
}

function defaultOriginTypeForSource(source: RawImportRow["source"]): RawImportRow["originType"] {
  return source === "youzhao" ? "web" : source;
}
