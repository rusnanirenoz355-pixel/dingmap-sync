import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { CleanMarker } from "@dingmap-sync/shared";
import {
  exportDingmapOneClickTemplate,
  filterExportableMarkers,
  isSafeDingmapExportFilename,
  resolveDingmapExportFilePath,
} from "./dingmap-export";

const databasePath = join(process.cwd(), "data", "test-dingmap-export.db");
const outputDir = join(process.cwd(), "data", "exports-test");

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

  it("writes an export file and non-sensitive sync records", async () => {
    const result = await exportDingmapOneClickTemplate({
      now: new Date("2026-06-08T09:30:00+08:00"),
      outputDir,
    });

    expect(result.exportedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.filename).toMatch(/^dingmap-import-\d{8}-\d{6}\.xlsx$/);
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
    expect(isSafeDingmapExportFilename("../dingmap-import-20260608-093000.xlsx")).toBe(false);
    expect(isSafeDingmapExportFilename("dingmap-import-20260608-093000.csv")).toBe(false);
  });

  it("resolves default export files under the project data exports directory", () => {
    expect(resolveDingmapExportFilePath("dingmap-import-20260608-093000.xlsx")).toBe(
      join(process.cwd(), "data", "exports", "dingmap-import-20260608-093000.xlsx"),
    );
  });
});

