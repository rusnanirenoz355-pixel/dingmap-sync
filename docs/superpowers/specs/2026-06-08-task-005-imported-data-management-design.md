# Task 005 Imported Data Management Design

## Goal

Build the first full management layer for already imported Clean Table data. Users can enter an independent `/data-management` page from the Dashboard, search and filter imported records, inspect anomalies, edit business fields, soft-delete records, and keep valid records eligible for the existing Task 003 DingMap template export.

Task 005 is implemented on top of the current `codex/task-004-excel-import` branch because it depends on Task 004's shared import pipeline and DB import service.

## Approved Scope

* Use layout option A: independent `/data-management` page with a fixed-row table and right-side Drawer.
* Add a Dashboard entry for managing imported data.
* Add Clean Table list/search/filter/statistics management APIs.
* Add single-record edit with server-side merge key and hash recalculation.
* Add soft delete through a new nullable `deleted_at` column.
* Exclude soft-deleted records from Dashboard default statistics, Clean Table default lists, and Task 003 export.
* Detect anomalies from current Clean Table state.
* Show long text as a table summary and full text in a Drawer/Modal.
* Keep Task 003 DingMap template fields unchanged.
* Do not add `import_batch_id` in the first version.
* Do not do DingMap upload/login, Playwright automation, OCR, external source collection, or batch import redesign.

## Branch And Integration

Task 005 continues on `codex/task-004-excel-import` instead of branching from `main`.

Reason:

1. Task 005 reuses Task 004's import pipeline and DB import service.
2. These APIs are not merged into `main` yet.
3. Developing Task 005 on top of Task 004 avoids duplicating or losing dependencies.

When Task 004 and Task 005 are both stable, PR and merge order should be handled together.

## Data Model

### Schema Change

Add one column to `clean_markers`:

```sql
deleted_at TEXT
```

Rules:

* `deleted_at IS NULL` means active/effective data.
* `deleted_at IS NOT NULL` means soft-deleted data.
* First version does not add `import_batch_id`.
* Existing database schema structure remains otherwise unchanged.

Migration should be idempotent. Existing databases need an `ALTER TABLE` path, while fresh databases should create `deleted_at` directly in `schema.sql`.

### Shared Types

Extend `CleanMarker` with:

```ts
deletedAt?: string | null;
```

Add management-specific DTOs rather than overloading import preview status:

```ts
type CleanMarkerManagementStatus = "normal" | "anomaly" | "deleted";
type CleanMarkerAnomalyReason =
  | "missing_coordinates"
  | "invalid_coordinates"
  | "has_error"
  | "possible_duplicate";
```

Anomaly state is derived from Clean Table rows, not copied from Task 002/004 import preview status.

## List And Statistics Behavior

Default list behavior:

* Show only rows where `deleted_at IS NULL`.
* Support pagination with a conservative default page size.
* Support search by `site_name` and `address`.
* Support filter by `source`.
* Support filter by active/deleted state.
* Support anomaly-only filter.
* Batch filter is not included in version one because `import_batch_id` is not added.

Statistics should exclude soft-deleted rows by default:

* active count
* anomaly count
* deleted count
* by-source counts if useful for Dashboard summaries

Dashboard Clean Table and imported-data summary should use this management/statistics service instead of counting all rows.

## Edit Behavior

Editable business fields:

* `siteName`
* `address`
* `longitude`
* `latitude`
* `stationManager`
* `phone`
* `salary`
* `welfare`
* `interviewTime`
* `jobTitle`
* `remark`

Read-only fields:

* `source`
* `originType`
* `sourceId`
* `createdAt`
* `updatedAt`

Save rules:

* API accepts only editable business fields.
* Server loads the current row from the database.
* Server ignores any client-supplied `source`, `originType`, `sourceId`, `createdAt`, `updatedAt`, `mergeKey`, `currentHash`, `syncAction`, `syncStatus`, and `manualOverride`.
* Server builds a normalized Clean Marker from the stored row plus editable updates.
* Server recomputes `merge_key` with the Task 004 shared import pipeline merge-key logic.
* Server recomputes `current_hash` with `buildMarkerHash`.
* Server sets `manual_override = 1`.
* Server sets `sync_action = 'update'`.
* Server sets `sync_status = 'pending'`.
* Server preserves `error_msg` in the first version. Clearing historical error messages is left for a later explicit resolution workflow.

If an edit cannot produce a merge key, the API should reject the save with a row-level error instead of writing an unusable record.

## Soft Delete Behavior

Soft delete API:

* Loads the row by id.
* Writes `deleted_at = datetime('now')`.
* Sets `sync_action = 'archive'` and `sync_status = 'skipped'` to mark the local record as no longer exportable in the first version.
* Leaves physical deletion out of scope.

Soft-deleted records:

* Do not appear in active list by default.
* Do not count in Dashboard active statistics.
* Do not appear in Task 003 export candidates.
* Can be viewed with an explicit deleted filter.
* Restore is reserved for a later task unless implementation is trivial and does not expand scope.

## Anomaly Detection

Derived anomaly reasons:

* `missing_coordinates`: `longitude` or `latitude` is null.
* `invalid_coordinates`: longitude is outside `[-180, 180]` or latitude is outside `[-90, 90]`.
* `has_error`: `error_msg` is not empty.
* `possible_duplicate`: more than one active row shares the same non-empty `merge_key`.

Anomaly status is for management attention. It does not automatically block Task 003 export. Soft delete is the blocking state.

## API Design

Create:

* `GET /api/clean-markers/manage`
* `PATCH /api/clean-markers/[id]`
* `DELETE /api/clean-markers/[id]`

### GET `/api/clean-markers/manage`

Query parameters:

* `page`
* `pageSize`
* `search`
* `source`
* `anomalyOnly`
* `includeDeleted`
* `deletedOnly`

Response:

```ts
interface ManagedCleanMarkerListResponse {
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
```

### PATCH `/api/clean-markers/[id]`

Request contains editable fields only. The route should sanitize/validate numeric coordinates and string fields, call `packages/db/clean-marker-management.ts`, and return the updated managed row plus refreshed statistics if needed.

### DELETE `/api/clean-markers/[id]`

Request contains no trusted state. The route should soft-delete by id and return the updated deleted row or a concise result object.

### Privacy Boundary

The management API returns normalized Clean Table business fields required for management. It does not return:

* `raw_records.raw_json`
* original uploaded rows
* generated DingMap export rows
* filesystem paths
* cookies, account data, `.env`, or auth material

Tests, task cards, docs, and issue drafts must use synthetic labels only and must not contain real phone numbers or real addresses.

## DB Service

Create:

```text
packages/db/clean-marker-management.ts
```

Responsibilities:

* `listManagedCleanMarkers(filters)`
* `getCleanMarkerManagementStatistics(filters?)`
* `updateManagedCleanMarker(id, editableFields)`
* `softDeleteCleanMarker(id)`
* map DB rows to `ManagedCleanMarker`
* derive anomaly reasons
* identify duplicate merge keys among active records
* keep soft-deleted rows out of default queries

This service can reuse:

* `buildMergeKey` from `packages/sources/import-pipeline`
* `buildMarkerHash` from `packages/normalizer/build-marker-hash`
* Clean Marker row mapping patterns from Task 004 DB import service

## Task 003 Export Changes

Task 003 export must exclude soft-deleted rows:

* DB query should add `AND deleted_at IS NULL`.
* `filterExportableMarkers` should also reject markers with `deletedAt`.
* Tests should cover deleted rows not exported.
* Template fields remain unchanged.

## Dashboard And `/data-management` UI

### Dashboard

Dashboard keeps the Task 004 import panels and Task 003 export panel. It adds:

* a clear entry button/link: `管理已导入数据`
* imported data summary from management statistics
* Clean Table default list excludes deleted rows

### `/data-management`

Use option A:

* independent route `apps/dashboard/app/data-management/page.tsx`
* top toolbar with search and filters
* fixed-height table rows
* sticky operation column
* horizontal scrolling for desktop and mobile
* pagination controls
* anomaly badges
* long text summaries, around 50 to 100 characters
* Drawer/Modal for editing and full text viewing

Drawer sections:

* editable fields
* read-only source/origin metadata
* anomaly reasons
* full text view for address/remark/welfare
* save/delete actions

UI style should continue the existing OKX-light direction: white background, black primary buttons, restrained gray surfaces, compact tables, no dark large background, no complex animation.

## Error Handling

List errors:

* invalid pagination values fall back to defaults
* impossible filters return empty results, not failures

Edit errors:

* missing id
* row not found
* row already deleted
* invalid coordinate values
* empty site name and empty address
* merge key cannot be generated

Delete errors:

* missing id
* row not found
* already deleted should be idempotent or return a clear deleted result

## Testing

Add tests for:

* migration adds `deleted_at` idempotently
* list excludes deleted rows by default
* list can include or show only deleted rows
* search by name/address
* filter by source
* anomaly detection: missing coordinates, invalid coordinates, error message, duplicate merge key
* edit only updates editable fields
* edit ignores read-only/client-trusted fields
* edit recomputes merge key and current hash
* edit sets manual override and pending update state
* soft delete writes `deleted_at`
* soft-deleted rows are excluded from statistics
* soft-deleted rows are excluded from Task 003 export
* API route list/edit/delete
* UI smoke for `/data-management`
* long text summary helper

Use synthetic test content only. Do not write real phone numbers or real addresses into tests or docs.

## Documentation

After implementation update:

* `docs/dev-log.md`
* `docs/task-cards/005-imported-data-management.md`
* `docs/github-issues/task-005-issue.md`

README and `.agent` only change if this task creates a long-term project rule. Current rules around privacy and task updates already cover this task.

## Out Of Scope

* No `import_batch_id` in version one.
* No restore button unless it falls out naturally without expanding scope.
* No hard delete.
* No map rendering.
* No DingMap upload/login.
* No Playwright automation.
* No OCR.
* No external source collection.
* No Task 003 template field changes.
* No real business data in Git.
