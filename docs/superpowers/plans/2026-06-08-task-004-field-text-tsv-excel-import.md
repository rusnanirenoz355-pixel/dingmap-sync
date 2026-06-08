# Task 004 Field Text, TSV, And Excel Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build field-name text, TSV paste, and header-based `.xlsx` import into Clean Table, then keep the existing Task 003 DingMap template export path reusable.

**Architecture:** Parser-specific modules produce source-tagged raw rows only. A shared import pipeline maps aliases, validates rows, computes merge keys/hashes, and determines `valid` / `invalid` / `duplicate` / `update_candidate`; a shared DB import service revalidates raw rows server-side before writing `raw_records` and `clean_markers`.

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, React dashboard, SQLite `node:sqlite`, ExcelJS.

---

## Privacy And Test Data Rules

* Runtime business data may include phone and address fields in `clean_markers`, `raw_records`, and DingMap exports.
* Tests, docs, issue drafts, task cards, and Git examples must not contain real phone numbers or real addresses.
* New tests that need a valid phone must build it from parts:

```ts
const syntheticPhone = ["199", "0000", "0000"].join("");
```

* Do not add full 11-digit phone literals such as `1xx00000000` to tests or docs.
* Use labels like `Alpha Site`, `Alpha Road`, `Manager A`, and `Synthetic remark` for synthetic test content.
* Keep `data/*.db`, `data/uploads/`, and `data/exports/` untracked.

## File Map

* Create `packages/sources/import-pipeline/types.ts`: generic raw import row and source/origin type definitions.
* Create `packages/sources/import-pipeline/preview.ts`: shared alias mapping, validation, merge key, hash, summary, and preview generation.
* Create `packages/sources/import-pipeline/mapper.ts`: shared preview-to-clean-marker mapper preserving row source/origin type.
* Create `packages/sources/import-pipeline/index.ts`: public exports for the shared pipeline.
* Modify `packages/sources/manual-paste/parser.ts`: keep public manual paste functions while parsing key-value blocks or TSV into shared raw rows.
* Modify `packages/sources/manual-paste/mapper.ts`: re-export or delegate to the shared mapper for compatibility.
* Create `packages/db/import-clean-markers.ts`: shared DB preview/import/list service.
* Modify `packages/db/manual-paste.ts`: keep public API as a wrapper over `import-clean-markers.ts`.
* Create `packages/sources/excel-import/parser.ts`: ExcelJS `.xlsx` buffer parser with file size, sheet, and row limits.
* Create `packages/sources/excel-import/index.ts`: public Excel parser exports.
* Create `packages/db/excel-import.ts`: preview/import wrappers for Excel raw rows.
* Create `apps/dashboard/app/api/excel/preview/route.ts`: multipart Excel preview route.
* Create `apps/dashboard/app/api/excel/import/route.ts`: JSON raw-row Excel import route.
* Modify `apps/dashboard/app/api/manual-paste/preview/route.ts`: return structured errors for empty/unparseable input.
* Modify `apps/dashboard/app/api/manual-paste/import/route.ts`: accept raw rows, not trusted statuses.
* Modify `apps/dashboard/app/page.tsx`: add separate paste and Excel import panels while keeping Clean Table and Task 003 export.
* Update `packages/sources/manual-paste/parser.test.ts`: remove full phone literals and cover key-value parsing.
* Add `packages/sources/import-pipeline/preview.test.ts`: shared pipeline behavior.
* Add `packages/db/import-clean-markers.test.ts`: insert/update/skip/revalidate DB behavior.
* Add `packages/sources/excel-import/parser.test.ts`: `.xlsx` parser behavior and limits.
* Add `apps/dashboard/app/api/excel/excel-routes.test.ts`: preview/import route behavior.
* Update `docs/dev-log.md`, `docs/task-cards/004-excel-to-clean-table.md`, and `docs/github-issues/task-004-issue.md`.

---

### Task 1: Shared Import Pipeline

**Files:**
* Create: `packages/sources/import-pipeline/types.ts`
* Create: `packages/sources/import-pipeline/preview.ts`
* Create: `packages/sources/import-pipeline/mapper.ts`
* Create: `packages/sources/import-pipeline/index.ts`
* Test: `packages/sources/import-pipeline/preview.test.ts`
* Modify: `packages/sources/manual-paste/parser.test.ts`

- [ ] **Step 1: Write failing shared pipeline tests**

Add `packages/sources/import-pipeline/preview.test.ts` with tests shaped like:

```ts
import { describe, expect, it } from "vitest";
import {
  buildImportPreview,
  buildMergeKey,
  summarizePreviewRows,
  type ExistingMarkerFingerprint,
  type RawImportRow,
} from "./preview";

const syntheticPhone = ["199", "0000", "0000"].join("");

function rawRow(raw: Record<string, string>): RawImportRow {
  return {
    rowIndex: 2,
    source: "manual_paste",
    originType: "manual_paste",
    rawText: Object.values(raw).join("\t"),
    raw,
  };
}

describe("shared import preview pipeline", () => {
  it("maps aliases and marks a new row as valid", () => {
    const rows = buildImportPreview([
      rawRow({
        站点名称: "Alpha Site",
        地址: "Alpha Road",
        联系人: "Manager A",
        电话: syntheticPhone,
        备注: "Synthetic remark",
      }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.mapped.siteName).toBe("Alpha Site");
    expect(rows[0]?.mapped.address).toBe("Alpha Road");
    expect(rows[0]?.mapped.stationManager).toBe("Manager A");
    expect(rows[0]?.mapped.phone).toBe(syntheticPhone);
    expect(rows[0]?.mapped.source).toBe("manual_paste");
    expect(rows[0]?.mapped.originType).toBe("manual_paste");
    expect(rows[0]?.status).toBe("valid");
  });

  it("keeps unknown columns in raw and reports invalid missing key fields", () => {
    const rows = buildImportPreview([
      rawRow({
        未识别字段: "Keep me",
        电话: "not-a-phone",
      }),
    ]);

    expect(rows[0]?.raw["未识别字段"]).toBe("Keep me");
    expect(rows[0]?.status).toBe("invalid");
    expect(rows[0]?.errors.length).toBeGreaterThan(0);
  });

  it("marks duplicate and update candidates from existing fingerprints", () => {
    const first = buildImportPreview([
      rawRow({
        站点名称: "Alpha Site",
        地址: "Alpha Road",
        电话: syntheticPhone,
      }),
    ])[0];
    const existing = new Map<string, ExistingMarkerFingerprint>([
      [
        first?.mergeKey ?? "",
        {
          id: 10,
          currentHash: first?.currentHash ?? null,
        },
      ],
    ]);
    const duplicate = buildImportPreview(
      [
        rawRow({
          站点名称: "Alpha Site",
          地址: "Alpha Road",
          电话: syntheticPhone,
        }),
      ],
      existing,
    );
    existing.set(first?.mergeKey ?? "", { id: 10, currentHash: "different-hash" });
    const update = buildImportPreview(
      [
        rawRow({
          站点名称: "Alpha Site",
          地址: "Alpha Road",
          电话: syntheticPhone,
          备注: "Changed remark",
        }),
      ],
      existing,
    );

    expect(duplicate[0]?.status).toBe("duplicate");
    expect(update[0]?.status).toBe("update_candidate");
  });

  it("summarizes preview statuses", () => {
    const rows = buildImportPreview([
      rawRow({ 站点名称: "Alpha Site", 地址: "Alpha Road", 电话: syntheticPhone }),
      rawRow({ 电话: "bad-phone" }),
    ]);

    expect(summarizePreviewRows(rows)).toMatchObject({ valid: 1, invalid: 1 });
  });

  it("builds merge keys from phone/address, site/address, or site/phone", () => {
    expect(buildMergeKey({ siteName: "Alpha Site", address: "Alpha Road" })).toContain(
      "site_address",
    );
    expect(buildMergeKey({ siteName: "Alpha Site", phone: syntheticPhone })).toContain(
      "site_phone",
    );
    expect(buildMergeKey({ address: "Alpha Road", phone: syntheticPhone })).toContain(
      "phone_address",
    );
  });
});
```

- [ ] **Step 2: Run RED for shared pipeline**

Run:

```bash
corepack pnpm vitest run packages/sources/import-pipeline/preview.test.ts
```

Expected: fail because `packages/sources/import-pipeline/preview.ts` does not exist.

- [ ] **Step 3: Implement shared pipeline**

Create `types.ts`, `preview.ts`, `mapper.ts`, and `index.ts`. The implementation must:

* Export `RawImportRow`, `ExistingMarkerFingerprint`, and `ImportPreviewSource`.
* Map aliases through `resolveFieldAlias`.
* Normalize optional phone values using `normalizePhoneForImport`.
* Set `syncAction = "review"` and `syncStatus = "need_confirm"` in preview `mapped`.
* Preserve `source` and `originType` from raw rows.
* Generate `mergeKey` using the Task 002 rules.
* Return `valid`, `invalid`, `duplicate`, or `update_candidate`.
* Map importable rows to clean marker partials with `syncAction = "create" | "update"`, `syncStatus = "pending"`, `lockedFields = []`, and `manualOverride = true`.

- [ ] **Step 4: Run GREEN for shared pipeline**

Run:

```bash
corepack pnpm vitest run packages/sources/import-pipeline/preview.test.ts
```

Expected: pass.

- [ ] **Step 5: Remove complete phone literals from existing tests**

Update `packages/sources/manual-paste/parser.test.ts`, `packages/normalizer/build-marker-hash.test.ts`, and `packages/normalizer/normalize-phone.test.ts` to use assembled synthetic phone constants instead of full 11-digit phone literals.

Run:

```bash
rg -n "1[3-9][0-9]{9}" packages apps docs
```

Expected: no test/doc full-phone matches except commit hashes in historical dev-log/issue text.

---

### Task 2: Manual Paste Parser Refactor

**Files:**
* Modify: `packages/sources/manual-paste/parser.ts`
* Modify: `packages/sources/manual-paste/mapper.ts`
* Modify: `packages/sources/manual-paste/parser.test.ts`

- [ ] **Step 1: Write failing key-value and TSV compatibility tests**

Extend `packages/sources/manual-paste/parser.test.ts` with:

```ts
it("parses key-value field text blocks", () => {
  const syntheticPhone = ["199", "0000", "0000"].join("");
  const text = [
    "站点名称：Alpha Site",
    "地址：Alpha Road",
    "联系人：Manager A",
    `电话：${syntheticPhone}`,
    "备注：Synthetic remark",
    "",
    "site_name: Beta Site",
    "address: Beta Road",
  ].join("\n");

  const rows = previewManualPasteText(text);

  expect(rows).toHaveLength(2);
  expect(rows[0]?.rowIndex).toBe(1);
  expect(rows[0]?.mapped.siteName).toBe("Alpha Site");
  expect(rows[0]?.mapped.phone).toBe(syntheticPhone);
  expect(rows[1]?.rowIndex).toBe(7);
  expect(rows[1]?.mapped.siteName).toBe("Beta Site");
  expect(rows[0]?.mapped.source).toBe("manual_paste");
  expect(rows[0]?.mapped.originType).toBe("manual_paste");
});

it("keeps TSV paste compatible with Task 002 behavior", () => {
  const syntheticPhone = ["199", "0000", "0000"].join("");
  const text = ["站点名称\t地址\t电话", `Alpha Site\tAlpha Road\t${syntheticPhone}`].join("\n");

  const rows = previewManualPasteText(text);

  expect(rows).toHaveLength(1);
  expect(rows[0]?.rowIndex).toBe(2);
  expect(rows[0]?.mapped.siteName).toBe("Alpha Site");
  expect(rows[0]?.status).toBe("valid");
});
```

- [ ] **Step 2: Run RED for manual paste parser**

Run:

```bash
corepack pnpm vitest run packages/sources/manual-paste/parser.test.ts
```

Expected: fail because key-value parsing is not implemented and parser still owns preview internals.

- [ ] **Step 3: Implement parser refactor**

Change `packages/sources/manual-paste/parser.ts` so:

* `parseManualPasteText(text)` auto-detects TSV if the first non-empty line contains `\t`.
* TSV parsing returns `RawImportRow[]` with `source = "manual_paste"` and `originType = "manual_paste"`.
* Key-value parsing splits records by blank lines, accepts `：` and `:`, skips empty blocks, and preserves unknown keys.
* `buildManualPastePreview(rows, existing)` calls `buildImportPreview(rows, existing)`.
* `previewManualPasteText(text, existing)` calls `parseManualPasteText` then shared preview.
* `buildMergeKey` and `ExistingMarkerFingerprint` are re-exported from the shared pipeline for compatibility.

Change `packages/sources/manual-paste/mapper.ts` so `mapPreviewRowToCleanMarker` delegates to `mapImportPreviewRowToCleanMarker`.

- [ ] **Step 4: Run GREEN for manual paste parser**

Run:

```bash
corepack pnpm vitest run packages/sources/manual-paste/parser.test.ts
```

Expected: pass.

---

### Task 3: Shared DB Import Service

**Files:**
* Create: `packages/db/import-clean-markers.ts`
* Modify: `packages/db/manual-paste.ts`
* Test: `packages/db/import-clean-markers.test.ts`

- [ ] **Step 1: Write failing DB import tests**

Add `packages/db/import-clean-markers.test.ts` with a temp database setup that creates `raw_records` and `clean_markers` from `packages/db/schema.sql`. Cover:

* Manual paste valid row inserts `clean_markers` and `raw_records`.
* Duplicate row skips without writing another clean marker.
* Update candidate updates the existing clean marker.
* Import ignores forged client status by revalidating from `raw`.
* Excel raw rows insert with `source = "excel"` and `originType = "excel"`.
* Inserted rows are eligible for `filterExportableMarkers`.

Use assembled synthetic phones:

```ts
const syntheticPhone = ["199", "0000", "0000"].join("");
```

- [ ] **Step 2: Run RED for DB import service**

Run:

```bash
corepack pnpm vitest run packages/db/import-clean-markers.test.ts
```

Expected: fail because `packages/db/import-clean-markers.ts` does not exist.

- [ ] **Step 3: Implement shared DB service**

Create `packages/db/import-clean-markers.ts` with:

* `previewRawImportRows(rows: RawImportRow[]): ImportPreviewResult`
* `importCleanMarkers(rows: Array<RawImportRow | ImportPreviewRow>): ImportCleanMarkersResult`
* `listCleanMarkers(existingDatabase?: DatabaseSync): CleanMarker[]`
* internal `loadExistingMarkerFingerprints`, `writeRawRecord`, `insertCleanMarker`, `updateCleanMarker`, and `mapCleanMarkerRow`

The service must:

* Open `resolveDatabasePath()` unless a test database is injected.
* Rebuild raw rows from incoming objects by reading only `rowIndex`, `source`, `originType`, `rawText`, and `raw`.
* Recompute preview status during import.
* Write `raw_records.source` from the row source.
* Generate safe `source_id` values like `${source}:${Date.now()}:${rowIndex}`.
* Insert `valid`, update `update_candidate`, skip `duplicate` and `invalid`.
* Keep phone/address as runtime business fields in DB rows.

Modify `packages/db/manual-paste.ts` to become a compatibility wrapper over the shared service.

- [ ] **Step 4: Run GREEN for DB import service**

Run:

```bash
corepack pnpm vitest run packages/db/import-clean-markers.test.ts packages/sources/manual-paste/parser.test.ts
```

Expected: pass.

---

### Task 4: Header-Based Excel Parser

**Files:**
* Create: `packages/sources/excel-import/parser.ts`
* Create: `packages/sources/excel-import/index.ts`
* Create: `packages/db/excel-import.ts`
* Test: `packages/sources/excel-import/parser.test.ts`

- [ ] **Step 1: Write failing Excel parser tests**

Add `packages/sources/excel-import/parser.test.ts` using ExcelJS to generate workbooks in memory. Cover:

* Default first sheet parsing.
* Selected sheet parsing.
* Alias mapping and source/origin type set to `excel`.
* Empty data rows skipped.
* Unknown columns preserved in `raw`.
* File larger than 5 MB rejected before parse.
* More than 1000 data rows rejected.

Use assembled synthetic phone constants and non-real site/address labels.

- [ ] **Step 2: Run RED for Excel parser**

Run:

```bash
corepack pnpm vitest run packages/sources/excel-import/parser.test.ts
```

Expected: fail because the Excel parser module does not exist.

- [ ] **Step 3: Implement Excel parser**

Create `parseExcelImportWorkbook(buffer, options)` returning:

```ts
interface ExcelImportPreviewResult {
  filename?: string;
  sheetNames: string[];
  selectedSheetName: string;
  rawRows: RawImportRow[];
  rows: ImportPreviewRow[];
  summary: PreviewSummary;
}
```

Implementation rules:

* `MAX_EXCEL_UPLOAD_BYTES = 5 * 1024 * 1024`.
* `MAX_EXCEL_DATA_ROWS = 1000`.
* Use `new ExcelJS.Workbook().xlsx.load(buffer)`.
* Default to the first worksheet.
* Throw clear `Error` messages for empty workbook, missing sheet, missing headers, size excess, and row excess.
* Convert cells to trimmed strings without writing files.
* Use `source = "excel"` and `originType = "excel"`.
* Call the shared pipeline for preview rows.

Create `packages/db/excel-import.ts` wrappers:

* `previewExcelImportBuffer(buffer, options)`
* `importExcelRows(rows)`

- [ ] **Step 4: Run GREEN for Excel parser**

Run:

```bash
corepack pnpm vitest run packages/sources/excel-import/parser.test.ts
```

Expected: pass.

---

### Task 5: Excel API Routes

**Files:**
* Create: `apps/dashboard/app/api/excel/preview/route.ts`
* Create: `apps/dashboard/app/api/excel/import/route.ts`
* Test: `apps/dashboard/app/api/excel/excel-routes.test.ts`

- [ ] **Step 1: Write failing route tests**

Add `apps/dashboard/app/api/excel/excel-routes.test.ts` that:

* Builds an in-memory `.xlsx` file with ExcelJS.
* Calls `POST` from `preview/route.ts` with `FormData`.
* Asserts response includes sanitized `filename`, `sheetNames`, `selectedSheetName`, preview `rows`, and summary.
* Calls `POST` from `import/route.ts` with returned raw rows.
* Asserts import result includes `inserted`, `updated`, `skippedDuplicate`, `skippedInvalid`, `updateCandidate`, and `cleanMarkers`.
* Asserts a non-`.xlsx` filename returns status `400`.

- [ ] **Step 2: Run RED for routes**

Run:

```bash
corepack pnpm vitest run apps/dashboard/app/api/excel/excel-routes.test.ts
```

Expected: fail because route modules do not exist.

- [ ] **Step 3: Implement routes**

`preview/route.ts` must:

* Use `runtime = "nodejs"`.
* Read `request.formData()`.
* Require `file` as a `File`.
* Reject unsafe/non-`.xlsx` basename.
* Read `await file.arrayBuffer()` and parse in memory.
* Return JSON without absolute paths.

`import/route.ts` must:

* Use `runtime = "nodejs"`.
* Accept `{ rows }`.
* Pass rows to `importExcelRows`.
* Return JSON result.
* Return status `400` for malformed input.

- [ ] **Step 4: Run GREEN for routes**

Run:

```bash
corepack pnpm vitest run apps/dashboard/app/api/excel/excel-routes.test.ts
```

Expected: pass.

---

### Task 6: Dashboard Import UI

**Files:**
* Modify: `apps/dashboard/app/page.tsx`

- [ ] **Step 1: Add UI state and handlers**

Add separate paste and Excel state:

* `pastePreviewRows`, `pasteSummary`, `pasteImportResult`
* `excelFile`, `excelFilename`, `excelSheetNames`, `excelSelectedSheetName`, `excelPreviewRows`, `excelSummary`, `excelImportResult`
* `loading` values for `paste-preview`, `paste-import`, `excel-preview`, `excel-import`, `clean`, and `export`

Add handlers:

* `handlePastePreview`
* `handlePasteImport`
* `handlePasteClear`
* `handleExcelFileChange`
* `handleExcelPreview`
* `handleExcelImport`
* `handleExcelClear`

- [ ] **Step 2: Add Excel panel while preserving Task 003 export**

Update the page so it shows:

* Paste panel accepting key-value or TSV.
* Excel panel with file input, selected safe filename, sheet selector after preview, preview/import/clear buttons.
* Shared `PreviewTable` and `ResultPill`.
* Clean Table and DingMap export sections unchanged in behavior.

- [ ] **Step 3: Run type/lint for UI**

Run:

```bash
corepack pnpm run check
corepack pnpm run lint
```

Expected: both pass.

---

### Task 7: Documentation And Issue Draft

**Files:**
* Create/Modify: `docs/task-cards/004-excel-to-clean-table.md`
* Create/Modify: `docs/github-issues/task-004-issue.md`
* Modify: `docs/dev-log.md`

- [ ] **Step 1: Write Task 004 docs**

Document:

* Key-value field text support.
* TSV support.
* Header-based `.xlsx` support.
* Shared import pipeline.
* Runtime phone/address policy.
* No real samples in Git.
* No schema change.
* No DingMap upload or Playwright.

- [ ] **Step 2: Run docs privacy scan**

Run:

```bash
rg -n "1[3-9][0-9]{9}|Cookie|C:/Users" docs packages apps
git ls-files data/*.db data/uploads data/exports .env .auth
```

Expected: no newly introduced sensitive sample data or tracked sensitive runtime files; existing historical commit hashes in docs are allowed when they are clearly commit hashes.

---

### Task 8: Full Verification, Commit, Push

**Files:**
* All changed files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
corepack pnpm vitest run packages/sources/import-pipeline/preview.test.ts packages/sources/manual-paste/parser.test.ts packages/db/import-clean-markers.test.ts packages/sources/excel-import/parser.test.ts apps/dashboard/app/api/excel/excel-routes.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full verification commands**

Run:

```bash
corepack pnpm run check
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run verify
```

Expected: all pass.

- [ ] **Step 3: Run Git safety checks**

Run:

```bash
git status --short
git ls-files data/*.db data/uploads data/exports .env .auth
rg -n "1[3-9][0-9]{9}" packages apps docs
```

Expected:

* No tracked sensitive files.
* No new full phone literals in tests/docs/examples.
* Only intended source/docs/test files changed.

- [ ] **Step 4: Commit and push**

Run:

```bash
git add packages apps docs
git commit -m "feat: import header excel and field text into clean table"
git push -u origin codex/task-004-excel-import
```

Expected: commit and push succeed.
