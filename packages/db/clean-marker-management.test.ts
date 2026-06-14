import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { CleanMarker } from "@dingmap-sync/shared";
import { buildMarkerHash } from "../normalizer/build-marker-hash";
import { buildMergeKey } from "../sources/import-pipeline";
import {
  listManagedCleanMarkers,
  softDeleteCleanMarker,
  updateManagedCleanMarker,
} from "./clean-marker-management";

const databasePath = join(process.cwd(), "data", "test-clean-marker-management.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

function seedMarker(overrides: Record<string, unknown> = {}): number {
  const marker = {
    source: "manual_paste",
    sourceId: "row-alpha",
    siteName: "Alpha Site",
    address: "Alpha Road",
    longitude: 120.12,
    latitude: 30.12,
    stationManager: "Manager A",
    phone: syntheticPhone,
    salary: "Synthetic salary",
    welfare: "Synthetic welfare",
    interviewTime: "Weekday",
    jobTitle: "Courier",
    remark: "Synthetic remark",
    originType: "manual_paste",
    syncAction: "create",
    syncStatus: "pending",
    errorMsg: null,
    deletedAt: null,
    ...overrides,
  };
  const mergeKey = String(
    overrides.mergeKey ?? buildMergeKey(marker as Partial<CleanMarker>) ?? "site_address:fallback",
  );
  const currentHash = String(
    overrides.currentHash ?? buildMarkerHash(marker as Partial<CleanMarker>),
  );
  const database = new DatabaseSync(databasePath);
  const result = database
    .prepare(
      `
        INSERT INTO clean_markers (
          source, source_id, site_name, address, longitude, latitude,
          station_manager, phone, salary, welfare, interview_time, job_title,
          remark, origin_type, sync_action, sync_status, current_hash,
          merge_key, manual_override, error_msg, deleted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      marker.source,
      marker.sourceId,
      marker.siteName,
      marker.address,
      marker.longitude,
      marker.latitude,
      marker.stationManager,
      marker.phone,
      marker.salary,
      marker.welfare,
      marker.interviewTime,
      marker.jobTitle,
      marker.remark,
      marker.originType,
      marker.syncAction,
      marker.syncStatus,
      currentHash,
      mergeKey,
      0,
      marker.errorMsg,
      marker.deletedAt,
    );
  database.close();
  return Number(result.lastInsertRowid);
}

describe("clean marker management service", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new DatabaseSync(databasePath);
    database.exec(schemaSql);
    database.close();
  });

  it("lists active rows by default and exposes deleted rows only when requested", () => {
    const activeId = seedMarker();
    seedMarker({
      siteName: "Deleted Site",
      address: "Deleted Road",
      deletedAt: "2026-06-08T10:00:00.000Z",
    });

    expect(listManagedCleanMarkers().rows.map((row) => row.id)).toEqual([activeId]);
    expect(listManagedCleanMarkers({ includeDeleted: true }).rows).toHaveLength(2);
    expect(listManagedCleanMarkers({ deletedOnly: true }).rows[0]?.managementStatus).toBe(
      "deleted",
    );
  });

  it("supports search and source filters", () => {
    seedMarker();
    seedMarker({
      source: "excel",
      sourceId: "row-beta",
      siteName: "Beta Site",
      address: "Beta Road",
    });

    expect(listManagedCleanMarkers({ search: "Beta" }).rows[0]?.siteName).toBe("Beta Site");
    expect(listManagedCleanMarkers({ source: "excel" }).rows[0]?.source).toBe("excel");
  });

  it("derives anomalies only from missing site name or address", () => {
    const duplicateKey = "site_address:duplicate:alpha-road";
    seedMarker({
      siteName: "Normal Without Optional Fields",
      address: "Normal Road",
      longitude: null,
      latitude: null,
      phone: null,
      interviewTime: null,
      errorMsg: "Synthetic error no longer marks anomaly",
      mergeKey: duplicateKey,
    });
    seedMarker({
      siteName: "Duplicate With Address",
      address: "Normal Road",
      longitude: 181,
      latitude: 91,
      mergeKey: duplicateKey,
    });
    seedMarker({ siteName: "  ", address: "Has Address" });
    seedMarker({ siteName: "Has Name", address: "  " });
    seedMarker({ siteName: "  ", address: "  " });

    const allRows = listManagedCleanMarkers({ pageSize: 20 }).rows;
    const anomalyRows = listManagedCleanMarkers({ anomalyOnly: true, pageSize: 20 }).rows;

    expect(allRows.filter((row) => row.managementStatus === "normal")).toHaveLength(2);
    expect(anomalyRows).toHaveLength(3);
    expect(anomalyRows.flatMap((row) => row.anomalyReasons)).toEqual(
      expect.arrayContaining(["missing_site_name", "missing_address"]),
    );
    expect(anomalyRows.flatMap((row) => row.anomalyReasons)).not.toEqual(
      expect.arrayContaining([
        "missing_coordinates",
        "invalid_coordinates",
        "has_error",
        "possible_duplicate",
      ]),
    );
  });

  it("updates only editable fields and recomputes merge key, hash, and sync state", () => {
    const id = seedMarker();
    const updated = updateManagedCleanMarker(id, {
      siteName: "Updated Site",
      address: "Updated Road",
      longitude: 121,
      latitude: 31,
      source: "excel",
      syncStatus: "synced",
    } as Record<string, unknown>);

    expect(updated).toMatchObject({
      id,
      siteName: "Updated Site",
      address: "Updated Road",
      source: "manual_paste",
      manualOverride: true,
      syncAction: "update",
      syncStatus: "pending",
    });
    expect(updated.mergeKey).toBe(buildMergeKey(updated));
    expect(updated.currentHash).toBe(buildMarkerHash(updated));
  });

  it("soft deletes rows and removes them from active statistics", () => {
    const id = seedMarker();

    const deleted = softDeleteCleanMarker(id);
    const activeList = listManagedCleanMarkers();
    const deletedList = listManagedCleanMarkers({ deletedOnly: true });

    expect(deleted.deletedAt).toEqual(expect.any(String));
    expect(deleted.syncAction).toBe("archive");
    expect(deleted.syncStatus).toBe("skipped");
    expect(activeList.statistics.activeCount).toBe(0);
    expect(deletedList.rows[0]?.id).toBe(id);
  });
});
