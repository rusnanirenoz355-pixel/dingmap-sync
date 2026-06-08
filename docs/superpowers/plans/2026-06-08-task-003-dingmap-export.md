# Task 003 DingMap Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standard Clean Table to DingMap one-click import `.xlsx` export layer.

**Architecture:** Keep template-specific fields in `packages/dingmap/export-template.ts`, workbook generation in `packages/dingmap/one-click-export.ts`, and database/API orchestration in `packages/db/dingmap-export.ts` plus Dashboard routes. Reuse `sync_plan` and `sync_logs`; do not add schema, upload to DingMap, use Playwright, or store the real template workbook.

**Tech Stack:** TypeScript, ExcelJS, Next.js App Router, SQLite `node:sqlite`, Vitest, ESLint, pnpm.

---

## File Structure

* Create `packages/dingmap/export-template.ts`: real DingMap header constants, row type, mapping functions, field-two fallback.
* Modify `packages/dingmap/one-click-export.ts`: use the seven configured DingMap fields and expose filename/workbook helpers.
* Create `packages/dingmap/export-template.test.ts`: tests for header order and row mapping.
* Create `packages/dingmap/one-click-export.test.ts`: tests for workbook headers and timestamped filename.
* Create `packages/db/dingmap-export.ts`: query exportable Clean Markers, write workbook under `data/exports/`, insert `sync_plan` and `sync_logs`.
* Create `packages/db/dingmap-export.test.ts`: tests for filtering and non-sensitive logging.
* Create `apps/dashboard/app/api/dingmap/export/route.ts`: POST route returning export JSON.
* Create `apps/dashboard/app/api/dingmap/download/[filename]/route.ts`: GET route serving generated `.xlsx` files by safe filename.
* Modify `apps/dashboard/app/page.tsx`: add export button, loading state, result display, download link.
* Create `docs/github-issues/task-003-issue.md`: local Issue draft and Done section.
* Modify `docs/dev-log.md`: record Task 003-A completion.
* Modify `docs/task-cards/003-dingmap-one-click-export.md`: record scope, verification, and completion status.

### Task 1: Template Mapping

**Files:**
* Create: `packages/dingmap/export-template.ts`
* Test: `packages/dingmap/export-template.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import {
  DINGMAP_IMPORT_HEADERS,
  mapCleanMarkerToDingmapImportRow,
} from "./export-template";

describe("dingmap export template", () => {
  it("keeps header order aligned with the real DingMap template", () => {
    expect(DINGMAP_IMPORT_HEADERS).toEqual([
      "标记名称",
      "详细地址",
      "经度",
      "纬度",
      "备注",
      "字段一",
      "字段二",
    ]);
  });

  it("maps clean markers to the seven DingMap import fields", () => {
    const row = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      sourceId: "row-1",
      siteName: "测试站点",
      address: "测试地址",
      longitude: 121.5,
      latitude: 31.2,
      stationManager: "张三",
      phone: "测试号码",
      remark: "  人工备注  ",
      interviewTime: "  周一  ",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(row["标记名称"]).toBe("测试站点");
    expect(row["详细地址"]).toBe("测试地址");
    expect(row["经度"]).toBe(121.5);
    expect(row["纬度"]).toBe(31.2);
    expect(row["备注"]).toContain("【系统同步信息】");
    expect(row["备注"]).toContain("【人工备注】");
    expect(row["字段一"]).toBe("张三测试号码");
    expect(row["字段二"]).toBe("人工备注");
  });

  it("uses interview time for field two when remark is blank", () => {
    const row = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      siteName: "测试站点",
      address: "测试地址",
      remark: "   ",
      interviewTime: "  明天上午  ",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(row["字段二"]).toBe("明天上午");
  });

  it("leaves field two blank when remark and interview time are blank", () => {
    const row = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      siteName: "测试站点",
      address: "测试地址",
      remark: "   ",
      interviewTime: "",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(row["字段二"]).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm test packages/dingmap/export-template.test.ts`
Expected: FAIL because `packages/dingmap/export-template.ts` does not exist.

- [ ] **Step 3: Implement mapping**

Create `packages/dingmap/export-template.ts` with the seven headers, `DingmapImportRow`, `buildFieldOne`, `buildFieldTwo`, and `mapCleanMarkerToDingmapImportRow`.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm test packages/dingmap/export-template.test.ts`
Expected: PASS.

### Task 2: Workbook And Filename

**Files:**
* Modify: `packages/dingmap/one-click-export.ts`
* Test: `packages/dingmap/one-click-export.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import {
  buildDingmapOneClickWorkbook,
  buildDingmapExportFilename,
} from "./one-click-export";

describe("dingmap one click export", () => {
  it("builds a workbook with the real DingMap template headers", () => {
    const workbook = buildDingmapOneClickWorkbook([
      {
        source: "manual_paste",
        siteName: "测试站点",
        address: "测试地址",
        stationManager: "张三",
        phone: "测试号码",
        originType: "manual_paste",
        syncAction: "create",
        syncStatus: "pending",
      },
    ]);
    const worksheet = workbook.getWorksheet("Sheet1");

    expect(worksheet?.getRow(1).values).toEqual([
      undefined,
      "标记名称",
      "详细地址",
      "经度",
      "纬度",
      "备注",
      "字段一",
      "字段二",
    ]);
    expect(worksheet?.getRow(2).getCell(1).value).toBe("测试站点");
    expect(worksheet?.getRow(2).getCell(6).value).toBe("张三测试号码");
  });

  it("generates timestamped xlsx filenames", () => {
    expect(buildDingmapExportFilename(new Date("2026-06-08T09:30:00+08:00"))).toMatch(
      /^dingmap-import-\d{8}-\d{6}\.xlsx$/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm test packages/dingmap/one-click-export.test.ts`
Expected: FAIL because workbook headers still use generalized fields and filename helper is missing.

- [ ] **Step 3: Implement workbook helpers**

Update `buildDingmapOneClickWorkbook` to create `Sheet1`, set the seven exact headers, add mapped rows, and keep `writeDingmapOneClickExport`. Add `buildDingmapExportFilename(now = new Date())`.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm test packages/dingmap/one-click-export.test.ts`
Expected: PASS.

### Task 3: Database Export Orchestration

**Files:**
* Create: `packages/db/dingmap-export.ts`
* Test: `packages/db/dingmap-export.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { exportDingmapOneClickTemplate, filterExportableMarkers } from "./dingmap-export";

const databasePath = join(process.cwd(), "data", "test-dingmap-export.db");

describe("dingmap export database orchestration", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
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
    `).run("manual_paste", "row-1", "测试站点", "测试地址", "张三", "测试号码", "manual_paste", "create", "pending", "hash-after", "hash-before");
    database.prepare(`
      INSERT INTO clean_markers (
        source, site_name, address, origin_type, sync_action, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run("manual_paste", "", "", "manual_paste", "create", "pending");
    database.close();
  });

  it("filters exportable markers", () => {
    expect(
      filterExportableMarkers([
        { source: "manual_paste", siteName: "", address: "", originType: "manual_paste", syncAction: "create", syncStatus: "pending" },
        { source: "manual_paste", siteName: "测试站点", address: "", originType: "manual_paste", syncAction: "create", syncStatus: "pending" },
        { source: "manual_paste", siteName: "失败站点", address: "地址", originType: "manual_paste", syncAction: "create", syncStatus: "failed" },
      ]),
    ).toHaveLength(1);
  });

  it("writes an export file and non-sensitive sync records", async () => {
    const result = await exportDingmapOneClickTemplate({
      now: new Date("2026-06-08T09:30:00+08:00"),
      outputDir: join(process.cwd(), "data", "exports-test"),
    });

    expect(result.exportedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(result.filename).toMatch(/^dingmap-import-\d{8}-\d{6}\.xlsx$/);
    expect(existsSync(result.filePath)).toBe(true);

    const database = new DatabaseSync(databasePath);
    const planRows = database.prepare("SELECT action, reason, status, before_hash, after_hash FROM sync_plan").all();
    const logRows = database.prepare("SELECT action, status, after_json FROM sync_logs").all() as Array<{ action: string; status: string; after_json: string }>;
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm test packages/db/dingmap-export.test.ts`
Expected: FAIL because `packages/db/dingmap-export.ts` does not exist.

- [ ] **Step 3: Implement DB export**

Create `DingmapExportResult`, `filterExportableMarkers`, `exportDingmapOneClickTemplate`, safe output directory handling, Clean Marker row mapping, and row-level `sync_plan` / `sync_logs` inserts with non-sensitive summaries.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm test packages/db/dingmap-export.test.ts`
Expected: PASS.

### Task 4: API Routes

**Files:**
* Create: `apps/dashboard/app/api/dingmap/export/route.ts`
* Create: `apps/dashboard/app/api/dingmap/download/[filename]/route.ts`

- [ ] **Step 1: Add route implementation using tested DB export**

`POST /api/dingmap/export` calls `exportDingmapOneClickTemplate()` and returns JSON. `GET /api/dingmap/download/[filename]` validates basename `.xlsx` filenames and returns the file.

- [ ] **Step 2: Run type check**

Run: `corepack pnpm check`
Expected: PASS after route types compile.

### Task 5: Dashboard Export UI

**Files:**
* Modify: `apps/dashboard/app/page.tsx`

- [ ] **Step 1: Add typed state and handler**

Add `DingmapExportResult` client type, export loading state, `handleDingmapExport`, and error/result state without disrupting manual paste flow.

- [ ] **Step 2: Add compact export section**

Add a light OKX-style panel with black `导出钉图模板` button, loading icon, filename, exported count, skipped count, error message, and download link.

- [ ] **Step 3: Run type check**

Run: `corepack pnpm check`
Expected: PASS.

### Task 6: Documentation And Issue Draft

**Files:**
* Modify: `docs/dev-log.md`
* Modify: `docs/task-cards/003-dingmap-one-click-export.md`
* Create: `docs/github-issues/task-003-issue.md`

- [ ] **Step 1: Update docs after implementation and verification**

Record implemented export behavior, test commands, schema status, sensitivity status, commit/push status, and GitHub Issue status.

- [ ] **Step 2: Inspect sensitive-file status**

Run: `git status --short --ignored`
Expected: `data/exports/`, databases, and generated runtime files are ignored or untracked but not staged.

### Task 7: Final Verification And Commit

**Files:**
* All touched files

- [ ] **Step 1: Run required verification**

Run:

```powershell
corepack pnpm check
corepack pnpm lint
corepack pnpm test
corepack pnpm verify
```

Expected: all commands exit 0.

- [ ] **Step 2: Commit**

Run:

```powershell
git status --short
git add packages/dingmap/export-template.ts packages/dingmap/export-template.test.ts packages/dingmap/one-click-export.ts packages/dingmap/one-click-export.test.ts packages/db/dingmap-export.ts packages/db/dingmap-export.test.ts apps/dashboard/app/api/dingmap/export/route.ts apps/dashboard/app/api/dingmap/download/[filename]/route.ts apps/dashboard/app/page.tsx docs/dev-log.md docs/task-cards/003-dingmap-one-click-export.md docs/github-issues/task-003-issue.md docs/superpowers/plans/2026-06-08-task-003-dingmap-export.md
git commit -m "feat: export clean table to dingmap import template"
```

Expected: commit succeeds with no sensitive files staged.

## Self-Review

* Spec coverage: The plan covers field configuration, Excel workbook, file naming, Dashboard export button, sync records, docs, and required verification.
* Placeholder scan: No `TBD`, `TODO`, or deferred implementation steps are intentionally left in this plan.
* Type consistency: The plan consistently uses `CleanMarker`, `syncAction`, `syncStatus`, `siteName`, `interviewTime`, `DingmapImportRow`, and `exportDingmapOneClickTemplate`.

