# Task 003 DingMap Export Design

## Goal

Implement the first closed-loop export from Clean Table to the real DingMap one-click import Excel template, using a field-configuration-driven exporter. The project must not save the original DingMap template workbook, real addresses, real phone numbers, or real sample rows.

## Approved Decisions

* Use field configuration and mapping functions instead of storing or reading the real template workbook at runtime.
* Export only Excel `.xlsx` in the first version; CSV can be added later if needed.
* Store generated files under `data/exports/`, which is already ignored by Git.
* Do not add or change database schema.
* Reuse `sync_plan` and `sync_logs` to record export behavior.
* Do not do DingMap upload, DingMap login, browser automation, or Playwright clicking.

## Real Template Header

The real DingMap template uses `Sheet1` row 1 with exactly these columns:

1. `标记名称`
2. `详细地址`
3. `经度`
4. `纬度`
5. `备注`
6. `字段一`
7. `字段二`

The repository will only store this header and mapping configuration. It will not store the original `.xlsx` file or any real data rows from that file.

## Field Mapping

Create `packages/dingmap/export-template.ts` as the single source of truth for DingMap export fields.

| DingMap field | Source |
| --- | --- |
| `标记名称` | `CleanMarker.siteName` |
| `详细地址` | `CleanMarker.address` |
| `经度` | `CleanMarker.longitude` |
| `纬度` | `CleanMarker.latitude` |
| `备注` | `buildDingmapDescription(marker)` |
| `字段一` | `${stationManager}${phone}` with missing parts treated as empty strings |
| `字段二` | `remark.trim()` first, then `interviewTime.trim()`, then empty string |

Numeric longitude and latitude should be written as numbers when available and empty cells when missing. Text fields should trim only where the mapping rule requires it and otherwise preserve the normalized Clean Table values.

## Architecture

`packages/dingmap/export-template.ts` defines the seven headers, a row type, and `mapCleanMarkerToDingmapImportRow(marker)`. `packages/dingmap/one-click-export.ts` builds the Excel workbook from those configured fields and no longer uses generalized columns.

`packages/db/dingmap-export.ts` will query exportable Clean Table rows, call the DingMap exporter, write the workbook to `data/exports/`, and record export rows in `sync_plan` and `sync_logs`. Keeping this database orchestration outside `packages/dingmap` keeps the DingMap package focused on template mapping and workbook generation.

The Dashboard will call a new server route at `apps/dashboard/app/api/dingmap/export/route.ts`. The route returns JSON containing the generated filename, exported count, skipped count, and a download URL. A download route can serve files from `data/exports/` by filename only, with path traversal blocked.

## Data Selection

The default export query includes rows where:

* `sync_status = 'pending'`
* `sync_action IN ('create', 'update')`
* `site_name` or `address` is not blank

Because duplicate and invalid rows are not imported into Clean Table by Task 002, they should not normally exist in the export set. The query and mapping still guard against unusable rows by skipping records where both name and address are blank. Future filters can support `source`, `action`, `limit`, and `includeFailed`, but the first UI only needs the default export button.

## Export File

Generated files use this format:

`dingmap-import-YYYYMMDD-HHmmss.xlsx`

The exporter creates `data/exports/` if it does not exist. The generated file is local runtime output and must remain ignored by Git.

## Sync Records

Do not add `export_logs`. Reuse existing tables:

* `sync_plan`: insert one row for each exported Clean Marker with `action = 'export'`, `reason = 'dingmap_one_click_template'`, `status = 'synced'`, `before_hash = last_synced_hash`, and `after_hash = current_hash`.
* `sync_logs`: insert one row for each exported Clean Marker with `action = 'export'`, `status = 'success'`, and `after_json` containing a non-sensitive export summary such as marker id, source, source id, filename, and exported field names.

The log must not store real phone numbers, real addresses, or full exported row values. If an export fails before row-level logging, insert a failure log with the run id, `action = 'export'`, `status = 'failed'`, and the error message.

## Dashboard

Add a compact DingMap export area to the current Dashboard, following the existing light OKX-style UI:

* Primary black button: `导出钉图模板`
* Loading state while the export request runs
* Result display with filename, exported count, skipped count, and download link
* Error message if export fails or no exportable records exist

The Clean Table remains the visible source of export records. The first version does not need multi-select or advanced filters.

## Error Handling

The API should return clear JSON errors for:

* No exportable Clean Table records
* Workbook write failure
* Database write failure
* Invalid download filename
* Missing export file during download

Generated filenames must be server-generated. The download route must only allow basename-style `.xlsx` filenames under `data/exports/`.

## Testing

Add focused tests without using the real template workbook:

* Header order exactly matches the real DingMap template header.
* `mapCleanMarkerToDingmapImportRow` maps all seven fields correctly.
* `字段一` combines station manager and phone with missing parts treated as empty strings.
* `字段二` uses trimmed remark first, then trimmed interview time, then empty string.
* `buildDingmapDescription` output remains in the `备注` field and includes `【系统同步信息】` and `【人工备注】`.
* Workbook generation writes the exact seven headers.
* Export filename matches `dingmap-import-YYYYMMDD-HHmmss.xlsx`.
* Export selection skips rows where both name and address are blank.

Run `corepack pnpm check`, `corepack pnpm lint`, `corepack pnpm test`, and `corepack pnpm verify` before completing the implementation task.

## Documentation And Issue Updates

After implementation, update:

* `docs/dev-log.md`
* `docs/task-cards/003-dingmap-one-click-export.md`
* `docs/github-issues/task-003-issue.md`

If GitHub Issue creation remains blocked by `403 Resource not accessible by integration`, keep the local Issue draft and Done comment updated with the commit hash and export status.

## Out Of Scope

* No original template workbook in Git
* No real template data rows in Git
* No real addresses or phone numbers in Git
* No DingMap upload
* No DingMap login
* No Playwright automation
* No browser clicking workflow
* No external source collection
* No database schema changes
