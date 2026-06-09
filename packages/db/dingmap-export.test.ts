import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { utimesSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { CleanMarker } from "@dingmap-sync/shared";
import {
  exportDingmapOneClickTemplate,
  filterExportableMarkers,
  isSafeDingmapExportFilename,
  listDingmapExportFiles,
  resolveDingmapExportFilePath,
  resolveExistingDingmapExportFilePath,
  selectLatestDingmapExportFile,
} from "./dingmap-export";

const databasePath = join(process.cwd(), "data", "test-dingmap-export.db");
const outputDir = join(process.cwd(), "data", "temp", "exports-test");

describe("dingmap export database orchestration", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE clean_markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        source_id TEXT,
        site_name TEXT NOT NULL,
        address TEXT NOT NULL,
        longitude REAL,
        latitude REAL,
        station_manager TEXT,
        phone TEXT,
        salary TEXT,
        welfare TEXT,
        interview_time TEXT,
        job_title TEXT,
        remark TEXT,
        origin_type TEXT NOT NULL,
        dingmap_marker_id TEXT,
        sync_action TEXT NOT NULL DEFAULT 'review',
        sync_status TEXT NOT NULL DEFAULT 'need_confirm',
        current_hash TEXT,
        last_synced_hash TEXT,
        locked_fields TEXT,
        merge_key TEXT,
        manual_override INTEGER NOT NULL DEFAULT 0,
        error_msg TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE sync_plan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        clean_marker_id INTEGER NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        before_hash TEXT,
        after_hash TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error_msg TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT
      );
      CREATE TABLE sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        action TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        status TEXT NOT NULL,
        error_msg TEXT,
        screenshot_path TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    database.prepare(`
      INSERT INTO clean_markers (
        source, source_id, site_name, address, station_manager, phone,
        origin_type, sync_action, sync_status, current_hash, last_synced_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "manual_paste",
      "row-1",
      "测试站点",
      "测试地址",
      "张三",
      "测试号码",
      "manual_paste",
      "create",
      "pending",
      "hash-after",
      "hash-before",
    );
    database.prepare(`
      INSERT INTO clean_markers (
        source, site_name, address, origin_type, sync_action, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("manual_paste", "", "", "manual_paste", "create", "pending");
    database.prepare(`
      INSERT INTO clean_markers (
        source, site_name, address, origin_type, sync_action, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      "manual_paste",
      "Deleted Site",
      "Deleted Road",
      "manual_paste",
      "create",
      "pending",
      "2026-06-08T10:00:00.000Z",
    );
    database.close();
  });

  it("filters exportable markers", () => {
    const markers: CleanMarker[] = [
      {
        source: "manual_paste",
        siteName: "",
        address: "",
        originType: "manual_paste",
        syncAction: "create",
        syncStatus: "pending",
      },
      {
        source: "manual_paste",
        siteName: "测试站点",
        address: "",
        originType: "manual_paste",
        syncAction: "create",
        syncStatus: "pending",
      },
      {
        source: "manual_paste",
        siteName: "失败站点",
        address: "地址",
        originType: "manual_paste",
        syncAction: "create",
        syncStatus: "failed",
      },
    ];

    expect(filterExportableMarkers(markers)).toHaveLength(1);
  });

  it("excludes soft-deleted markers from exportable markers", () => {
    const markers: CleanMarker[] = [
      {
        source: "manual_paste",
        siteName: "Deleted Site",
        address: "Deleted Road",
        originType: "manual_paste",
        syncAction: "create",
        syncStatus: "pending",
        deletedAt: "2026-06-08T10:00:00.000Z",
      },
      {
        source: "manual_paste",
        siteName: "Active Site",
        address: "Active Road",
        originType: "manual_paste",
        syncAction: "create",
        syncStatus: "pending",
        deletedAt: null,
      },
    ];

    expect(filterExportableMarkers(markers).map((marker) => marker.siteName)).toEqual([
      "Active Site",
    ]);
  });

  it("writes an export file and non-sensitive sync records", async () => {
    const result = await exportDingmapOneClickTemplate({
      now: new Date("2026-06-08T09:30:00+08:00"),
      outputDir,
    });

    expect(result.exportedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.filename).toBe("面试点-未命名-6.8-09.30.xlsx");
    expect(existsSync(result.filePath)).toBe(true);

    const database = new DatabaseSync(databasePath);
    const planRows = database
      .prepare("SELECT action, reason, status, before_hash, after_hash FROM sync_plan")
      .all();
    const logRows = database
      .prepare("SELECT action, status, after_json FROM sync_logs")
      .all() as Array<{ action: string; status: string; after_json: string }>;
    database.close();

    expect(planRows).toHaveLength(1);
    expect(planRows[0]).toMatchObject({
      action: "export",
      reason: "dingmap_one_click_template",
      status: "synced",
      before_hash: "hash-before",
      after_hash: "hash-after",
    });
    expect(logRows).toHaveLength(1);
    expect(logRows[0]?.action).toBe("export");
    expect(logRows[0]?.status).toBe("success");
    expect(logRows[0]?.after_json).toContain(result.filename);
    expect(logRows[0]?.after_json).not.toContain("测试号码");
    expect(logRows[0]?.after_json).not.toContain("测试地址");
  });

  it("accepts only safe xlsx export filenames", () => {
    expect(isSafeDingmapExportFilename("dingmap-import-20260608-093000.xlsx")).toBe(true);
    expect(isSafeDingmapExportFilename("dingmap-import-美团点-余杭区第一批-20260609-142530.xlsx")).toBe(
      true,
    );
    expect(isSafeDingmapExportFilename("美团点-苏州黑闸-6.9-17.31.xlsx")).toBe(true);
    expect(isSafeDingmapExportFilename("美团点-未命名-6.9-17.31.xlsx")).toBe(true);
    expect(isSafeDingmapExportFilename("../dingmap-import-20260608-093000.xlsx")).toBe(false);
    expect(isSafeDingmapExportFilename("dingmap-import-美团点/余杭-20260609-142530.xlsx")).toBe(
      false,
    );
    expect(isSafeDingmapExportFilename("美团点/苏州黑闸-6.9-17.31.xlsx")).toBe(false);
    expect(isSafeDingmapExportFilename("dingmap-import-20260608-093000.csv")).toBe(false);
  });

  it("resolves default export files under the project data exports directory", () => {
    expect(resolveDingmapExportFilePath("dingmap-import-20260608-093000.xlsx")).toBe(
      join(process.cwd(), "data", "exports", "dingmap-import-20260608-093000.xlsx"),
    );
  });

  it("rejects path traversal when resolving existing export files", () => {
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "dingmap-import-20260608-093000.xlsx"), "xlsx");

    expect(() =>
      resolveExistingDingmapExportFilePath("../dingmap-import-20260608-093000.xlsx", outputDir),
    ).toThrow("导出文件名无效");
  });

  it("lists and selects recent export files by modified time", () => {
    mkdirSync(outputDir, { recursive: true });
    const olderFile = join(outputDir, "dingmap-import-20260608-093000.xlsx");
    const newerFile = join(outputDir, "dingmap-import-20260608-100000.xlsx");
    const namedFile = join(outputDir, "dingmap-import-美团点-余杭区第一批-20260608-110000.xlsx");
    const shortNamedFile = join(outputDir, "美团点-苏州黑闸-6.9-17.31.xlsx");
    writeFileSync(olderFile, "older");
    writeFileSync(newerFile, "newer");
    writeFileSync(namedFile, "named");
    writeFileSync(shortNamedFile, "short-named");
    writeFileSync(join(outputDir, "notes.txt"), "ignore");
    utimesSync(olderFile, new Date("2026-06-08T01:30:00Z"), new Date("2026-06-08T01:30:00Z"));
    utimesSync(namedFile, new Date("2026-06-08T01:45:00Z"), new Date("2026-06-08T01:45:00Z"));
    utimesSync(newerFile, new Date("2026-06-08T02:00:00Z"), new Date("2026-06-08T02:00:00Z"));
    utimesSync(
      shortNamedFile,
      new Date("2026-06-08T02:30:00Z"),
      new Date("2026-06-08T02:30:00Z"),
    );

    const files = listDingmapExportFiles(outputDir);

    expect(files.map((file) => file.filename)).toEqual([
      "美团点-苏州黑闸-6.9-17.31.xlsx",
      "dingmap-import-20260608-100000.xlsx",
      "dingmap-import-美团点-余杭区第一批-20260608-110000.xlsx",
      "dingmap-import-20260608-093000.xlsx",
    ]);
    expect(selectLatestDingmapExportFile(outputDir)?.filename).toBe(
      "美团点-苏州黑闸-6.9-17.31.xlsx",
    );
  });
});

