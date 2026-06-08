# Task 005 Imported Data Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Clean Table imported-data management with search, filters, editing, soft delete, anomaly display, long-text handling, and soft-delete exclusion from Dashboard defaults and DingMap export.

**Architecture:** Add `deleted_at` as the only schema change, centralize management reads/writes in `packages/db/clean-marker-management.ts`, expose thin Next API routes, and build `/data-management` as an OKX-light client page with a fixed table plus Drawer. Existing Task 004 import pipeline remains the source of merge-key behavior, and Task 003 export keeps the same seven DingMap fields while excluding soft-deleted rows.

**Tech Stack:** TypeScript, Node `node:sqlite`, Next.js App Router, React 19, Tailwind CSS, Vitest, ExcelJS existing export tests.

---

## File Structure

- Modify `packages/shared/marker.ts`: add `deletedAt` to `CleanMarker` and export management DTO types.
- Modify `packages/db/schema.sql`: add nullable `deleted_at TEXT` to fresh `clean_markers` tables.
- Modify `packages/db/migrate.ts`: run idempotent `ALTER TABLE clean_markers ADD COLUMN deleted_at TEXT` for existing databases.
- Modify `packages/db/import-clean-markers.ts`: map `deleted_at`, exclude deleted records from default lists and duplicate fingerprints.
- Create `packages/db/clean-marker-management.ts`: list, statistics, edit, soft-delete, anomaly detection, duplicate merge-key detection.
- Modify `packages/db/dingmap-export.ts`: exclude `deleted_at IS NOT NULL` records in SQL and in `filterExportableMarkers`.
- Create `apps/dashboard/app/api/clean-markers/manage/route.ts`: management list API.
- Create `apps/dashboard/app/api/clean-markers/[id]/route.ts`: edit and soft-delete API.
- Create `apps/dashboard/app/components/TruncatedText.tsx`: bounded text summary helper and component.
- Create `apps/dashboard/app/components/ManagementDrawer.tsx`: detail/edit/delete Drawer.
- Create `apps/dashboard/app/data-management/page.tsx`: independent management page.
- Modify `apps/dashboard/app/page.tsx`: add management entry and active/imported statistics.
- Add tests in `packages/db/clean-marker-management.test.ts`, `packages/db/migrate.test.ts`, `apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts`, and `apps/dashboard/app/components/TruncatedText.test.ts`.
- Update docs in `docs/dev-log.md`, `docs/task-cards/005-imported-data-management.md`, and `docs/github-issues/task-005-issue.md`.

## Shared Test Helpers

Use synthetic phone numbers only:

```ts
const syntheticPhone = ["199", "0000", "0000"].join("");
```

Use synthetic addresses only:

```ts
const alphaAddress = "Alpha Road";
const betaAddress = "Beta Road";
```

Set isolated SQLite paths inside each test:

```ts
process.env.DATABASE_URL = `file:${databasePath}`;
```

---

### Task 1: Schema And Migration

**Files:**
- Modify: `packages/shared/marker.ts`
- Modify: `packages/db/schema.sql`
- Modify: `packages/db/migrate.ts`
- Test: `packages/db/migrate.test.ts`

- [ ] **Step 1: Write the failing migration tests**

Create `packages/db/migrate.test.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureCleanMarkersDeletedAtColumn } from "./migrate";

const databasePath = join(process.cwd(), "data", "test-migrate-deleted-at.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");

function columnNames(database: DatabaseSync): string[] {
  return database
    .prepare("PRAGMA table_info(clean_markers)")
    .all()
    .map((row) => String((row as { name: string }).name));
}

describe("database deleted_at migration", () => {
  beforeEach(() => {
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    mkdirSync(dirname(databasePath), { recursive: true });
  });

  it("creates fresh clean_markers tables with deleted_at", () => {
    const database = new DatabaseSync(databasePath);
    database.exec(schemaSql);

    expect(columnNames(database)).toContain("deleted_at");

    database.close();
  });

  it("adds deleted_at to old clean_markers tables idempotently", () => {
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE clean_markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        site_name TEXT NOT NULL,
        address TEXT NOT NULL
      );
    `);

    ensureCleanMarkersDeletedAtColumn(database);
    ensureCleanMarkersDeletedAtColumn(database);

    expect(columnNames(database).filter((name) => name === "deleted_at")).toHaveLength(1);

    database.close();
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm test packages/db/migrate.test.ts
```

Expected: FAIL because `ensureCleanMarkersDeletedAtColumn` is not exported and/or `deleted_at` is absent from fresh schema.

- [ ] **Step 3: Implement the schema and migration**

Update `packages/shared/marker.ts`:

```ts
deletedAt?: string | null;
```

Update `packages/db/schema.sql` inside `clean_markers`:

```sql
  error_msg TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
```

Update `packages/db/migrate.ts`:

```ts
export function ensureCleanMarkersDeletedAtColumn(database: DatabaseSync): void {
  const rows = database.prepare("PRAGMA table_info(clean_markers)").all() as Array<{ name: string }>;
  if (!rows.some((row) => row.name === "deleted_at")) {
    database.exec("ALTER TABLE clean_markers ADD COLUMN deleted_at TEXT");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const database = new DatabaseSync(databasePath);
  database.exec(schemaSql);
  ensureCleanMarkersDeletedAtColumn(database);
  database.close();
  console.log(`SQLite migration completed: ${databasePath}`);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
corepack pnpm test packages/db/migrate.test.ts
```

Expected: PASS.

---

### Task 2: DB Management Service

**Files:**
- Create: `packages/db/clean-marker-management.ts`
- Modify: `packages/db/import-clean-markers.ts`
- Test: `packages/db/clean-marker-management.test.ts`
- Test: `packages/db/import-clean-markers.test.ts`

- [ ] **Step 1: Write failing DB service tests**

Create `packages/db/clean-marker-management.test.ts` with synthetic records:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
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
  const mergeKey = String(overrides.mergeKey ?? buildMergeKey(marker) ?? "site_address:fallback");
  const currentHash = String(overrides.currentHash ?? buildMarkerHash(marker));
  const database = new DatabaseSync(databasePath);
  const result = database
    .prepare(`
      INSERT INTO clean_markers (
        source, source_id, site_name, address, longitude, latitude,
        station_manager, phone, salary, welfare, interview_time, job_title,
        remark, origin_type, sync_action, sync_status, current_hash,
        merge_key, manual_override, error_msg, deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
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
    seedMarker({ siteName: "Deleted Site", address: "Deleted Road", deletedAt: "2026-06-08T10:00:00.000Z" });

    expect(listManagedCleanMarkers().rows.map((row) => row.id)).toEqual([activeId]);
    expect(listManagedCleanMarkers({ includeDeleted: true }).rows).toHaveLength(2);
    expect(listManagedCleanMarkers({ deletedOnly: true }).rows[0]?.managementStatus).toBe("deleted");
  });

  it("supports search and source filters", () => {
    seedMarker();
    seedMarker({ source: "excel", sourceId: "row-beta", siteName: "Beta Site", address: "Beta Road" });

    expect(listManagedCleanMarkers({ search: "Beta" }).rows[0]?.siteName).toBe("Beta Site");
    expect(listManagedCleanMarkers({ source: "excel" }).rows[0]?.source).toBe("excel");
  });

  it("derives missing coordinate, invalid coordinate, error, and duplicate anomalies", () => {
    const duplicateKey = "site_address:duplicate:alpha-road";
    seedMarker({ siteName: "Missing Coord", longitude: null });
    seedMarker({ siteName: "Invalid Coord", longitude: 181 });
    seedMarker({ siteName: "Error Site", errorMsg: "Synthetic error" });
    seedMarker({ siteName: "Duplicate One", mergeKey: duplicateKey });
    seedMarker({ siteName: "Duplicate Two", mergeKey: duplicateKey });

    const rows = listManagedCleanMarkers({ anomalyOnly: true, pageSize: 20 }).rows;
    const reasons = rows.flatMap((row) => row.anomalyReasons);

    expect(reasons).toContain("missing_coordinates");
    expect(reasons).toContain("invalid_coordinates");
    expect(reasons).toContain("has_error");
    expect(reasons).toContain("possible_duplicate");
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
```

- [ ] **Step 2: Add failing default-list test**

Append to `packages/db/import-clean-markers.test.ts`:

```ts
it("excludes soft-deleted rows from default Clean Table lists", () => {
  importCleanMarkers([validManualRow()]);
  const database = new DatabaseSync(databasePath);
  database.prepare("UPDATE clean_markers SET deleted_at = datetime('now')").run();
  database.close();

  expect(listCleanMarkers()).toHaveLength(0);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
corepack pnpm test packages/db/clean-marker-management.test.ts packages/db/import-clean-markers.test.ts
```

Expected: FAIL because `clean-marker-management.ts` does not exist and default list still includes deleted rows.

- [ ] **Step 4: Implement DB service and default list exclusions**

Implement `packages/db/clean-marker-management.ts` with these public exports:

```ts
export type CleanMarkerManagementStatus = "normal" | "anomaly" | "deleted";
export type CleanMarkerAnomalyReason =
  | "missing_coordinates"
  | "invalid_coordinates"
  | "has_error"
  | "possible_duplicate";

export interface ManagedCleanMarker extends CleanMarker {
  deletedAt: string | null;
  managementStatus: CleanMarkerManagementStatus;
  anomalyReasons: CleanMarkerAnomalyReason[];
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

export function listManagedCleanMarkers(options: ListManagedCleanMarkersOptions = {}): ManagedCleanMarkerListResult;
export function updateManagedCleanMarker(id: number, fields: Record<string, unknown>): ManagedCleanMarker;
export function softDeleteCleanMarker(id: number): ManagedCleanMarker;
```

Implementation details:

- Load rows from `clean_markers`.
- Default to `deleted_at IS NULL`.
- `deletedOnly` means `deleted_at IS NOT NULL`.
- `includeDeleted` means both active and deleted.
- Derive duplicates from active rows only with non-empty `merge_key`.
- Sanitize pagination with `page >= 1`, `1 <= pageSize <= 100`.
- Sanitize editable string fields with `String(value).trim()` except nullable numeric coordinates.
- Reject updates if both site name and address are empty or if `buildMergeKey` returns null.
- Reject invalid numeric coordinates on edit.
- Set `manual_override = 1`, `sync_action = 'update'`, `sync_status = 'pending'`.
- Set soft delete to `deleted_at = datetime('now')`, `sync_action = 'archive'`, `sync_status = 'skipped'`.

Modify `packages/db/import-clean-markers.ts`:

- Add `deleted_at` to row type.
- Map `deletedAt: row.deleted_at ?? null`.
- Add `WHERE deleted_at IS NULL` to `listCleanMarkers`.
- Add `AND deleted_at IS NULL` to `loadExistingMarkerFingerprints`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
corepack pnpm test packages/db/clean-marker-management.test.ts packages/db/import-clean-markers.test.ts
```

Expected: PASS.

---

### Task 3: DingMap Export Excludes Deleted Rows

**Files:**
- Modify: `packages/db/dingmap-export.ts`
- Test: `packages/db/dingmap-export.test.ts`

- [ ] **Step 1: Write failing export tests**

Update `packages/db/dingmap-export.test.ts`:

```ts
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

  expect(filterExportableMarkers(markers).map((marker) => marker.siteName)).toEqual(["Active Site"]);
});
```

In the test schema add:

```sql
deleted_at TEXT,
```

Seed one pending deleted row and expect `skippedCount` to include it or verify no sync plan row is written for it.

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
corepack pnpm test packages/db/dingmap-export.test.ts
```

Expected: FAIL because `filterExportableMarkers` does not reject `deletedAt` yet.

- [ ] **Step 3: Implement export filtering**

Update `listExportCandidateMarkers`:

```sql
WHERE sync_status = 'pending'
  AND sync_action IN ('create', 'update')
  AND deleted_at IS NULL
```

Update `filterExportableMarkers`:

```ts
if (marker.deletedAt) {
  return false;
}
```

Map `deletedAt` in `mapCleanMarkerRow`.

- [ ] **Step 4: Run focused test and verify GREEN**

Run:

```bash
corepack pnpm test packages/db/dingmap-export.test.ts
```

Expected: PASS.

---

### Task 4: Management API Routes

**Files:**
- Create: `apps/dashboard/app/api/clean-markers/manage/route.ts`
- Create: `apps/dashboard/app/api/clean-markers/[id]/route.ts`
- Test: `apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, PATCH } from "./[id]/route";
import { GET } from "./manage/route";

const databasePath = join(process.cwd(), "data", "test-clean-marker-management-routes.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

function seedRouteMarker(): number {
  const database = new DatabaseSync(databasePath);
  const result = database.prepare(`
    INSERT INTO clean_markers (
      source, source_id, site_name, address, longitude, latitude, phone,
      origin_type, sync_action, sync_status, current_hash, merge_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "manual_paste",
    "route-row",
    "Route Site",
    "Route Road",
    120,
    30,
    syntheticPhone,
    "manual_paste",
    "create",
    "pending",
    "before-hash",
    "site_address:route-site:route-road",
  );
  database.close();
  return Number(result.lastInsertRowid);
}

describe("clean marker management API routes", () => {
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

  it("lists managed rows with pagination, statistics, and sources", async () => {
    seedRouteMarker();
    const response = await GET(new Request("http://localhost/api/clean-markers/manage?page=1&pageSize=10"));
    const json = await response.json() as {
      rows: Array<{ siteName: string; rawJson?: unknown }>;
      pagination: { total: number };
      statistics: { activeCount: number };
      sources: string[];
    };

    expect(response.status).toBe(200);
    expect(json.rows[0]?.siteName).toBe("Route Site");
    expect(json.rows[0]?.rawJson).toBeUndefined();
    expect(json.pagination.total).toBe(1);
    expect(json.statistics.activeCount).toBe(1);
    expect(json.sources).toContain("manual_paste");
  });

  it("patches editable fields and ignores trusted client fields", async () => {
    const id = seedRouteMarker();
    const response = await PATCH(
      new Request(`http://localhost/api/clean-markers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: "Route Updated",
          address: "Route Updated Road",
          source: "excel",
          syncStatus: "synced",
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    const json = await response.json() as { marker: { source: string; syncStatus: string; siteName: string } };

    expect(response.status).toBe(200);
    expect(json.marker.siteName).toBe("Route Updated");
    expect(json.marker.source).toBe("manual_paste");
    expect(json.marker.syncStatus).toBe("pending");
  });

  it("rejects invalid coordinates", async () => {
    const id = seedRouteMarker();
    const response = await PATCH(
      new Request(`http://localhost/api/clean-markers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longitude: 181 }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );

    expect(response.status).toBe(400);
  });

  it("soft deletes rows idempotently", async () => {
    const id = seedRouteMarker();
    const first = await DELETE(new Request(`http://localhost/api/clean-markers/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: String(id) }),
    });
    const second = await DELETE(new Request(`http://localhost/api/clean-markers/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: String(id) }),
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run focused API tests and verify RED**

Run:

```bash
corepack pnpm test apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts
```

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement API routes**

`apps/dashboard/app/api/clean-markers/manage/route.ts`:

```ts
import { listManagedCleanMarkers } from "../../../../../../packages/db/clean-marker-management";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return Response.json(
    listManagedCleanMarkers({
      page: Number(url.searchParams.get("page")),
      pageSize: Number(url.searchParams.get("pageSize")),
      search: url.searchParams.get("search") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      anomalyOnly: url.searchParams.get("anomalyOnly") === "true",
      includeDeleted: url.searchParams.get("includeDeleted") === "true",
      deletedOnly: url.searchParams.get("deletedOnly") === "true",
    }),
  );
}
```

`apps/dashboard/app/api/clean-markers/[id]/route.ts`:

```ts
import {
  CleanMarkerManagementError,
  softDeleteCleanMarker,
  updateManagedCleanMarker,
} from "../../../../../../packages/db/clean-marker-management";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    return Response.json({ marker: updateManagedCleanMarker(Number(id), body) });
  } catch (error) {
    return handleManagementError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await context.params;
    return Response.json({ marker: softDeleteCleanMarker(Number(id)) });
  } catch (error) {
    return handleManagementError(error);
  }
}
```

- [ ] **Step 4: Run focused API tests and verify GREEN**

Run:

```bash
corepack pnpm test apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts
```

Expected: PASS.

---

### Task 5: Long Text Component And Management UI

**Files:**
- Create: `apps/dashboard/app/components/TruncatedText.tsx`
- Create: `apps/dashboard/app/components/ManagementDrawer.tsx`
- Create: `apps/dashboard/app/data-management/page.tsx`
- Modify: `vitest.config.ts` if `.test.tsx` support is needed
- Test: `apps/dashboard/app/components/TruncatedText.test.ts`

- [ ] **Step 1: Write failing long-text helper tests**

Create `apps/dashboard/app/components/TruncatedText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeText } from "./TruncatedText";

describe("summarizeText", () => {
  it("keeps short text unchanged", () => {
    expect(summarizeText("Short value", 50)).toEqual({
      summary: "Short value",
      isTruncated: false,
    });
  });

  it("trims and truncates long text without returning the full value", () => {
    const value = "Synthetic long remark ".repeat(10);
    const result = summarizeText(value, 50);

    expect(result.isTruncated).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(51);
    expect(result.summary).toContain("...");
    expect(result.summary).not.toBe(value);
  });
});
```

- [ ] **Step 2: Run focused component test and verify RED**

Run:

```bash
corepack pnpm test apps/dashboard/app/components/TruncatedText.test.ts
```

Expected: FAIL because `TruncatedText.tsx` does not exist.

- [ ] **Step 3: Implement UI components and page**

Implement `summarizeText` and `TruncatedText`:

```ts
export function summarizeText(value: string | null | undefined, maxLength = 80) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) {
    return { summary: text || "-", isTruncated: false };
  }
  return { summary: `${text.slice(0, maxLength).trimEnd()}...`, isTruncated: true };
}
```

`/data-management` page requirements:

- `use client`.
- Fetch `/api/clean-markers/manage`.
- Toolbar: search input, source select, anomaly checkbox, include deleted checkbox, deleted only checkbox.
- Table with `min-w-[1200px]`, fixed row height, `table-fixed`, and sticky operation column.
- Use `TruncatedText` for address, salary, welfare, remark, and error message.
- Open `ManagementDrawer` for view/edit.
- Drawer has editable fields listed in the design and read-only source/origin/sourceId/createdAt/updatedAt/deletedAt.
- Save sends `PATCH /api/clean-markers/${id}`.
- Delete sends `DELETE /api/clean-markers/${id}`.

- [ ] **Step 4: Run focused component test and verify GREEN**

Run:

```bash
corepack pnpm test apps/dashboard/app/components/TruncatedText.test.ts
```

Expected: PASS.

---

### Task 6: Dashboard Entry And Default Statistics

**Files:**
- Modify: `apps/dashboard/app/page.tsx`
- Modify: `apps/dashboard/app/api/clean-markers/route.ts`

- [ ] **Step 1: Write failing behavior coverage**

Add to `apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts`:

```ts
it("default clean markers API excludes deleted rows", async () => {
  const id = seedRouteMarker();
  await DELETE(new Request(`http://localhost/api/clean-markers/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id: String(id) }),
  });

  const { GET: getCleanMarkers } = await import("./route");
  const response = await getCleanMarkers();
  const json = await response.json() as { cleanMarkers: unknown[] };

  expect(json.cleanMarkers).toHaveLength(0);
});
```

- [ ] **Step 2: Run API tests and verify RED if default API still includes deleted**

Run:

```bash
corepack pnpm test apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts
```

Expected: FAIL until `listCleanMarkers` excludes deleted rows.

- [ ] **Step 3: Implement Dashboard changes**

In `apps/dashboard/app/page.tsx`:

- Add `ExternalLink` or `Settings2` icon from `lucide-react`.
- Add a management entry near the Clean Table statistic:

```tsx
<a
  className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800"
  href="/data-management"
>
  <Settings2 aria-hidden="true" className="h-4 w-4" />
  <span>管理已导入数据</span>
</a>
```

- Fetch `/api/clean-markers/manage?pageSize=1` for `activeCount`, `anomalyCount`, and `deletedCount`, or reuse `cleanMarkers.length` for active count plus management statistics if fetched.
- Keep the existing import panels and Task 003 export button.

- [ ] **Step 4: Run API tests and type check**

Run:

```bash
corepack pnpm test apps/dashboard/app/api/clean-markers/clean-marker-management-routes.test.ts
corepack pnpm run check
```

Expected: PASS.

---

### Task 7: Full Verification And Browser Smoke

**Files:**
- No new production files unless verification exposes defects.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
corepack pnpm run check
corepack pnpm run lint
corepack pnpm test
corepack pnpm run verify
```

Expected: all commands exit 0.

- [ ] **Step 2: Start or reuse the Dashboard dev server**

Run:

```bash
corepack pnpm run dev
```

Expected: Next.js dev server starts and shows a localhost URL.

- [ ] **Step 3: Browser smoke without Playwright**

Use the in-app Browser at the dev server URL:

- Open `/`.
- Confirm Dashboard renders.
- Confirm `管理已导入数据` entry is visible.
- Open `/data-management`.
- Confirm search input, source filter, anomaly filter, deleted filters, table header, and Drawer trigger render.
- Check desktop and narrow viewport if the Browser tool supports viewport changes.

If the dev server cannot be started because the existing user server is already running, inspect the current URL and test the active server instead.

---

### Task 8: Documentation, Sensitive File Audit, Commit, Push

**Files:**
- Modify: `docs/dev-log.md`
- Create: `docs/task-cards/005-imported-data-management.md`
- Create: `docs/github-issues/task-005-issue.md`

- [ ] **Step 1: Update docs**

Record:

- Branch: `codex/task-005-imported-data-management`.
- Base: current Task 004 branch, not main.
- Schema change: only `deleted_at`.
- `import_batch_id`: not added.
- APIs and UI route.
- Soft delete export/statistics behavior.
- Validation command results.
- Commit hash after commit.

- [ ] **Step 2: Audit for sensitive files and real sample data**

Run:

```bash
git status --short
git ls-files data/*.db data/uploads data/exports .env .auth
rg -n "1[3-9][0-9]{9}" apps packages docs
```

Expected:

- No tracked runtime DB/upload/export/auth/env files.
- Only synthetic phone construction appears in tests, not complete real phone samples in docs or issue drafts.

- [ ] **Step 3: Stage and commit**

Run:

```bash
git add packages apps docs vitest.config.ts
git commit -m "feat: manage imported clean table data"
```

Expected: commit succeeds.

- [ ] **Step 4: Push branch**

Run:

```bash
git push -u origin codex/task-005-imported-data-management
```

Expected: push succeeds.

---

## Self-Review

Spec coverage:

- Dashboard entry: Task 6.
- `/data-management` independent page with Drawer: Task 5.
- Only `deleted_at`, no `import_batch_id`: Task 1 and docs in Task 8.
- Soft delete excludes default list/statistics/export: Tasks 2, 3, and 6.
- Edit editable fields only and server-side recomputation: Task 2 and Task 4.
- Anomaly detection from Clean Table state: Task 2.
- API routes: Task 4.
- Long text fixed layout and full-text Drawer: Task 5.
- No DingMap upload/login, Playwright, OCR, external sources, raw JSON exposure: Tasks 4, 5, and docs/audit in Task 8.
- Verification: Task 7.

Placeholder scan:

- The plan contains no placeholder work items or unbounded testing instructions.
- Each task names exact files, focused commands, expected red/green state, and concrete snippets.

Type consistency:

- `deletedAt` maps to SQL `deleted_at`.
- `manualOverride`, `syncAction`, `syncStatus`, `currentHash`, and `mergeKey` match `CleanMarker`.
- API response keys use `rows`, `pagination`, `statistics`, and `sources` consistently.
