import { DatabaseSync } from "node:sqlite";
import type { CleanMarker } from "@dingmap-sync/shared";
import { buildMarkerHash } from "../normalizer/build-marker-hash";
import { buildMergeKey } from "../sources/import-pipeline";
import { resolveDatabasePath } from "./database-url";

export type CleanMarkerManagementStatus = "normal" | "anomaly" | "deleted";

export type CleanMarkerAnomalyReason =
  | "missing_coordinates"
  | "invalid_coordinates"
  | "has_error"
  | "possible_duplicate";

export interface ManagedCleanMarker extends CleanMarker {
  id: number;
  deletedAt: string | null;
  managementStatus: CleanMarkerManagementStatus;
  anomalyReasons: CleanMarkerAnomalyReason[];
}

export interface CleanMarkerManagementStatistics {
  totalCount: number;
  activeCount: number;
  deletedCount: number;
  anomalyCount: number;
  bySource: Record<string, number>;
}

export interface ListManagedCleanMarkersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  source?: string;
  anomalyOnly?: boolean;
  includeDeleted?: boolean;
  deletedOnly?: boolean;
}

export interface ManagedCleanMarkerListResult {
  rows: ManagedCleanMarker[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  statistics: CleanMarkerManagementStatistics;
  sources: string[];
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

type EditableFields = Pick<
  CleanMarker,
  | "siteName"
  | "address"
  | "longitude"
  | "latitude"
  | "stationManager"
  | "phone"
  | "salary"
  | "welfare"
  | "interviewTime"
  | "jobTitle"
  | "remark"
>;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const STRING_EDITABLE_FIELDS = [
  "stationManager",
  "phone",
  "salary",
  "welfare",
  "interviewTime",
  "jobTitle",
  "remark",
] as const;

export class CleanMarkerManagementError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "CleanMarkerManagementError";
  }
}

export function listManagedCleanMarkers(
  options: ListManagedCleanMarkersOptions = {},
): ManagedCleanMarkerListResult {
  const database = openDatabase();
  try {
    const rows = loadManagedRows(database);
    const baseFiltered = filterBySearchAndSource(rows, options);
    const statistics = buildStatistics(baseFiltered);
    const sources = Array.from(new Set(rows.map((row) => row.source).filter(Boolean))).sort();
    const visibleRows = applyVisibilityFilters(baseFiltered, options);
    const { page, pageSize } = normalizePagination(options);
    const total = visibleRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;

    return {
      rows: visibleRows.slice(start, start + pageSize),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      statistics,
      sources,
    };
  } finally {
    database.close();
  }
}

export function updateManagedCleanMarker(
  id: number,
  fields: Record<string, unknown>,
): ManagedCleanMarker {
  const markerId = normalizeId(id);
  const database = openDatabase();
  try {
    const current = loadManagedRowById(database, markerId);
    if (current.deletedAt) {
      throw new CleanMarkerManagementError("已删除数据不能在第一版中编辑。", 409);
    }

    const editableFields = normalizeEditableFields(current, fields);
    const nextMarker: CleanMarker = {
      ...current,
      ...editableFields,
      manualOverride: true,
      syncAction: "update",
      syncStatus: "pending",
    };

    if (!nextMarker.siteName.trim() && !nextMarker.address.trim()) {
      throw new CleanMarkerManagementError("站点名称和地址不能同时为空。", 400);
    }

    const mergeKey = buildMergeKey(nextMarker);
    if (!mergeKey) {
      throw new CleanMarkerManagementError("无法生成 merge_key。", 400);
    }

    const currentHash = buildMarkerHash(nextMarker);
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
            merge_key = ?,
            manual_override = 1,
            updated_at = datetime('now')
          WHERE id = ?
        `,
      )
      .run(
        nextMarker.siteName,
        nextMarker.address,
        nextMarker.longitude ?? null,
        nextMarker.latitude ?? null,
        nextMarker.stationManager ?? null,
        nextMarker.phone ?? null,
        nextMarker.salary ?? null,
        nextMarker.welfare ?? null,
        nextMarker.interviewTime ?? null,
        nextMarker.jobTitle ?? null,
        nextMarker.remark ?? null,
        currentHash,
        mergeKey,
        markerId,
      );

    return loadManagedRowById(database, markerId);
  } finally {
    database.close();
  }
}

export function softDeleteCleanMarker(id: number): ManagedCleanMarker {
  const markerId = normalizeId(id);
  const database = openDatabase();
  try {
    const current = loadManagedRowById(database, markerId);
    if (!current.deletedAt) {
      database
        .prepare(
          `
            UPDATE clean_markers
            SET
              deleted_at = datetime('now'),
              sync_action = 'archive',
              sync_status = 'skipped',
              updated_at = datetime('now')
            WHERE id = ?
          `,
        )
        .run(markerId);
    }

    return loadManagedRowById(database, markerId);
  } finally {
    database.close();
  }
}

function openDatabase(): DatabaseSync {
  return new DatabaseSync(resolveDatabasePath());
}

function loadManagedRows(database: DatabaseSync): ManagedCleanMarker[] {
  const rows = database
    .prepare(
      `
        SELECT *
        FROM clean_markers
        ORDER BY updated_at DESC, id DESC
      `,
    )
    .all() as CleanMarkerDbRow[];
  const duplicateCounts = buildDuplicateMergeKeyCounts(rows);
  return rows.map((row) => mapManagedCleanMarkerRow(row, duplicateCounts));
}

function loadManagedRowById(database: DatabaseSync, id: number): ManagedCleanMarker {
  const row = database
    .prepare(
      `
        SELECT *
        FROM clean_markers
        WHERE id = ?
      `,
    )
    .get(id) as CleanMarkerDbRow | undefined;

  if (!row) {
    throw new CleanMarkerManagementError("Clean Marker 不存在。", 404);
  }

  const rows = database.prepare("SELECT id, merge_key, deleted_at FROM clean_markers").all() as Array<
    Pick<CleanMarkerDbRow, "id" | "merge_key" | "deleted_at">
  >;
  return mapManagedCleanMarkerRow(row, buildDuplicateMergeKeyCounts(rows));
}

function buildDuplicateMergeKeyCounts(
  rows: Array<Pick<CleanMarkerDbRow, "merge_key" | "deleted_at">>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const mergeKey = row.merge_key?.trim();
    if (!mergeKey || row.deleted_at) {
      continue;
    }
    counts.set(mergeKey, (counts.get(mergeKey) ?? 0) + 1);
  }
  return counts;
}

function mapManagedCleanMarkerRow(
  row: CleanMarkerDbRow,
  duplicateCounts: Map<string, number>,
): ManagedCleanMarker {
  const deletedAt = row.deleted_at ?? null;
  const anomalyReasons = deletedAt ? [] : deriveAnomalyReasons(row, duplicateCounts);
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
    deletedAt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    managementStatus: deletedAt ? "deleted" : anomalyReasons.length > 0 ? "anomaly" : "normal",
    anomalyReasons,
  };
}

function deriveAnomalyReasons(
  row: Pick<
    CleanMarkerDbRow,
    "longitude" | "latitude" | "error_msg" | "merge_key" | "deleted_at"
  >,
  duplicateCounts: Map<string, number>,
): CleanMarkerAnomalyReason[] {
  const reasons: CleanMarkerAnomalyReason[] = [];
  const longitude = row.longitude;
  const latitude = row.latitude;

  if (longitude === null || latitude === null) {
    reasons.push("missing_coordinates");
  }

  if (
    (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) ||
    (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
  ) {
    reasons.push("invalid_coordinates");
  }

  if (row.error_msg?.trim()) {
    reasons.push("has_error");
  }

  const mergeKey = row.merge_key?.trim();
  if (mergeKey && (duplicateCounts.get(mergeKey) ?? 0) > 1) {
    reasons.push("possible_duplicate");
  }

  return reasons;
}

function filterBySearchAndSource(
  rows: ManagedCleanMarker[],
  options: ListManagedCleanMarkersOptions,
): ManagedCleanMarker[] {
  const search = options.search?.trim().toLowerCase();
  const source = options.source?.trim();
  return rows.filter((row) => {
    if (source && row.source !== source) {
      return false;
    }

    if (!search) {
      return true;
    }

    return (
      row.siteName.toLowerCase().includes(search) ||
      row.address.toLowerCase().includes(search)
    );
  });
}

function applyVisibilityFilters(
  rows: ManagedCleanMarker[],
  options: ListManagedCleanMarkersOptions,
): ManagedCleanMarker[] {
  return rows.filter((row) => {
    if (options.deletedOnly) {
      return Boolean(row.deletedAt);
    }

    if (!options.includeDeleted && row.deletedAt) {
      return false;
    }

    if (options.anomalyOnly && row.managementStatus !== "anomaly") {
      return false;
    }

    return true;
  });
}

function buildStatistics(rows: ManagedCleanMarker[]): CleanMarkerManagementStatistics {
  const activeRows = rows.filter((row) => !row.deletedAt);
  return {
    totalCount: rows.length,
    activeCount: activeRows.length,
    deletedCount: rows.length - activeRows.length,
    anomalyCount: activeRows.filter((row) => row.managementStatus === "anomaly").length,
    bySource: activeRows.reduce<Record<string, number>>((counts, row) => {
      counts[row.source] = (counts[row.source] ?? 0) + 1;
      return counts;
    }, {}),
  };
}

function normalizePagination(options: ListManagedCleanMarkersOptions): {
  page: number;
  pageSize: number;
} {
  const page = Number.isInteger(options.page) && Number(options.page) > 0 ? Number(options.page) : DEFAULT_PAGE;
  const requestedPageSize =
    Number.isInteger(options.pageSize) && Number(options.pageSize) > 0
      ? Number(options.pageSize)
      : DEFAULT_PAGE_SIZE;
  return {
    page,
    pageSize: Math.min(requestedPageSize, MAX_PAGE_SIZE),
  };
}

function normalizeEditableFields(
  current: ManagedCleanMarker,
  fields: Record<string, unknown>,
): EditableFields {
  const editable: EditableFields = {
    siteName: hasOwn(fields, "siteName") ? normalizeRequiredString(fields.siteName) : current.siteName,
    address: hasOwn(fields, "address") ? normalizeRequiredString(fields.address) : current.address,
    longitude: hasOwn(fields, "longitude")
      ? normalizeCoordinate(fields.longitude, "longitude")
      : current.longitude,
    latitude: hasOwn(fields, "latitude")
      ? normalizeCoordinate(fields.latitude, "latitude")
      : current.latitude,
    stationManager: current.stationManager,
    phone: current.phone,
    salary: current.salary,
    welfare: current.welfare,
    interviewTime: current.interviewTime,
    jobTitle: current.jobTitle,
    remark: current.remark,
  };

  for (const field of STRING_EDITABLE_FIELDS) {
    if (hasOwn(fields, field)) {
      editable[field] = normalizeOptionalString(fields[field]);
    }
  }

  return editable;
}

function normalizeRequiredString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeOptionalString(value: unknown): string | null {
  const text = normalizeRequiredString(value);
  return text ? text : null;
}

function normalizeCoordinate(value: unknown, field: "longitude" | "latitude"): number | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const coordinate = typeof value === "number" ? value : Number(String(value).trim());
  const min = field === "longitude" ? -180 : -90;
  const max = field === "longitude" ? 180 : 90;

  if (!Number.isFinite(coordinate) || coordinate < min || coordinate > max) {
    throw new CleanMarkerManagementError(`${field} 坐标无效。`, 400);
  }

  return coordinate;
}

function normalizeId(id: number): number {
  if (!Number.isInteger(id) || id <= 0) {
    throw new CleanMarkerManagementError("Clean Marker ID 无效。", 400);
  }
  return id;
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

function hasOwn<T extends string>(
  value: Record<string, unknown>,
  key: T,
): value is Record<T, unknown> & Record<string, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}
