import { DatabaseSync } from "node:sqlite";
import type { CleanMarker, ImportPreviewRow, ImportPreviewStatus } from "../shared";
import { mapPreviewRowToCleanMarker } from "../sources/manual-paste/mapper";
import {
  buildManualPastePreview,
  type ExistingMarkerFingerprint,
  type ManualPasteRawRow,
  previewManualPasteText,
} from "../sources/manual-paste/parser";
import { resolveDatabasePath } from "./database-url";

export interface PreviewSummary {
  valid: number;
  invalid: number;
  duplicate: number;
  update_candidate: number;
}

export interface ManualPastePreviewResult {
  rows: ImportPreviewRow[];
  summary: PreviewSummary;
}

export interface ManualPasteImportResult {
  inserted: number;
  updated: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  skippedOther: number;
  updateCandidate: number;
  cleanMarkers: CleanMarker[];
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
  created_at: string;
  updated_at: string;
};

export function previewManualPaste(text: string): ManualPastePreviewResult {
  const database = openDatabase();
  try {
    const existingMarkers = loadExistingMarkerFingerprints(database);
    const rows = previewManualPasteText(text, existingMarkers);
    return {
      rows,
      summary: summarizePreviewRows(rows),
    };
  } finally {
    database.close();
  }
}

export function importManualPaste(rows: ImportPreviewRow[]): ManualPasteImportResult {
  const database = openDatabase();
  const result: Omit<ManualPasteImportResult, "cleanMarkers"> = {
    inserted: 0,
    updated: 0,
    skippedDuplicate: 0,
    skippedInvalid: 0,
    skippedOther: 0,
    updateCandidate: 0,
  };

  try {
    database.exec("BEGIN");

    for (const row of rows) {
      const existingMarkers = loadExistingMarkerFingerprints(database);
      const revalidated = revalidatePreviewRow(row, existingMarkers);

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

function revalidatePreviewRow(
  row: ImportPreviewRow,
  existingMarkers: Map<string, ExistingMarkerFingerprint>,
): ImportPreviewRow {
  const rawRow: ManualPasteRawRow = {
    rowIndex: row.rowIndex,
    rawText: row.rawText,
    raw: row.raw,
  };

  return buildManualPastePreview([rawRow], existingMarkers)[0] ?? row;
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

function summarizePreviewRows(rows: ImportPreviewRow[]): PreviewSummary {
  return rows.reduce(
    (summary, row) => {
      summary[row.status] += 1;
      return summary;
    },
    {
      valid: 0,
      invalid: 0,
      duplicate: 0,
      update_candidate: 0,
    } satisfies Record<ImportPreviewStatus, number>,
  );
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
      "manual_paste",
      `manual_paste:${Date.now()}:${row.rowIndex}`,
      marker.siteName ?? null,
      marker.address ?? null,
      marker.phone ?? null,
      marker.salary ?? null,
      marker.welfare ?? null,
      marker.stationManager ?? null,
      JSON.stringify({
        rowIndex: row.rowIndex,
        raw: row.raw,
        mapped: row.mapped,
        status: row.status,
        warnings: row.warnings,
      }),
      row.status,
    );
}

function insertCleanMarker(database: DatabaseSync, row: ImportPreviewRow): void {
  const marker = mapPreviewRowToCleanMarker(row);
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
      marker.source ?? "manual_paste",
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
  const marker = mapPreviewRowToCleanMarker(row);
  database
    .prepare(
      `
        UPDATE clean_markers
        SET
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
