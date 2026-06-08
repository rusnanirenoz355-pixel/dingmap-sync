# Task 004 Excel Import Design

## Goal

Implement the first `.xlsx` Excel import path for messy but header-based spreadsheets. Excel rows enter Clean Table through the same preview, validation, dedupe, revalidation, and database import rules as manual paste rows, then continue to reuse the Task 003 DingMap template export layer.

## Approved Scope

* Support `.xlsx` files with the first row as headers.
* Read the first worksheet by default and allow a selected worksheet name.
* Limit uploads to 5 MB.
* Limit parsed data rows to 1000.
* Parse in memory by default; do not persist uploaded files.
* If a future fallback must write upload files, only use `data/uploads/` and delete files after import.
* Preserve unrecognized columns in `raw`.
* Do not infer missing headers.
* Do not merge multiple worksheets.
* Do not do OCR, image recognition, DingMap upload, DingMap login, Playwright automation, external source collection, scheduled sync, or database schema changes.

## Existing System Fit

Task 002 currently implements manual paste as a complete vertical path:

* `packages/sources/manual-paste/parser.ts` parses TSV, maps aliases, validates rows, builds `mergeKey`, computes `currentHash`, and resolves preview status.
* `packages/sources/manual-paste/mapper.ts` maps preview rows to `CleanMarker`.
* `packages/db/manual-paste.ts` previews, revalidates, writes `raw_records`, inserts or updates `clean_markers`, and lists Clean Table rows.

Task 004 must split this path at the correct seam: parsers differ, but preview status, validation, dedupe, revalidation, and database writes become shared infrastructure.

Task 003 already provides the standard output layer. Task 004 must not modify DingMap template fields. It only needs to ensure Excel-imported Clean Markers use `sync_status = 'pending'` and `sync_action = 'create' | 'update'`, so they are picked up by the existing DingMap export query.

## Architecture

### Shared Import Pipeline

Create `packages/sources/import-pipeline/` for source-agnostic preview logic:

* `types.ts`: shared raw row input type with `source`, `originType`, `rowIndex`, `rawText`, and `raw`.
* `preview.ts`: convert raw rows into `ImportPreviewRow[]` using field aliases, phone normalization, required-field checks, merge key generation, hash generation, and duplicate/update detection.
* `mapper.ts`: map any valid or update preview row to `Partial<CleanMarker>` while preserving source and origin type.

The shared pipeline owns:

* Header alias resolution through existing `packages/normalizer/field-aliases.ts`.
* `siteName` / `address` / `phone` / `salary` / `welfare` / `stationManager` / `interviewTime` / `jobTitle` / `remark` mapping.
* Rule: `siteName` or `address` must exist.
* Rule: phone is optional, but if provided it must normalize to a reasonable 11-digit mainland China mobile number.
* Rule: empty address is a warning, not an error.
* Rule: a merge key must be generated from phone+address, site+address, or site+phone.
* Statuses: `valid`, `invalid`, `duplicate`, `update_candidate`.

### Manual Paste Refactor

Keep the public manual paste API stable:

* `previewManualPaste(text)`
* `importManualPaste(rows)`
* `previewManualPasteText(text)`

Refactor internals so manual paste only parses TSV into generic raw rows, then calls the shared pipeline with `source = 'manual_paste'` and `originType = 'manual_paste'`.

### Excel Parser

Create `packages/sources/excel-import/parser.ts`.

Responsibilities:

* Accept an in-memory `.xlsx` buffer.
* Reject files larger than 5 MB before workbook parsing.
* Read workbook with ExcelJS.
* Return worksheet names for Dashboard selection.
* Parse the selected worksheet, defaulting to the first worksheet.
* Use row 1 as headers.
* Skip fully empty rows.
* Stop with an error if more than 1000 data rows are present.
* Preserve every recognized and unrecognized header/value pair in `raw`.
* Convert each row to a shared raw import row with `source = 'excel'` and `originType = 'excel'`.
* Produce preview rows by calling the shared pipeline.

Excel parser does not write files and does not write the database.

### Shared Database Import

Create `packages/db/import-clean-markers.ts`.

Responsibilities:

* Load existing marker fingerprints by `merge_key`.
* Preview generic raw rows through the shared pipeline.
* Revalidate server-side during import from the original raw rows.
* Write `raw_records` using each row's source.
* Insert valid rows into `clean_markers`.
* Update `update_candidate` rows using the existing merge key.
* Skip `invalid` and `duplicate`.
* Return inserted, updated, skipped, and Clean Table result counts.

Manual paste DB functions become thin wrappers over the shared DB import module. Excel DB functions call the same module with Excel raw rows.

### API

Create:

* `apps/dashboard/app/api/excel/preview/route.ts`
* `apps/dashboard/app/api/excel/import/route.ts`

`preview` accepts `multipart/form-data`:

* field `file`: required `.xlsx`
* field `sheetName`: optional

It validates filename extension, size, and safe basename display. It parses in memory and returns:

* `filename`
* `sheetNames`
* `selectedSheetName`
* `rows`
* `summary`

`import` accepts JSON with raw rows from the preview response, not client-computed status. It revalidates on the server before writing to the database.

### Dashboard

Add an Excel import panel near the manual paste import panel:

* File input for `.xlsx`
* Display selected safe filename
* Optional sheet selector after preview
* `生成预览`
* `清空`
* `导入 Clean Table`
* Preview table and result statistics

Keep the existing OKX-light style: white background, light gray surfaces, black primary buttons, compact tables, simple status colors. Keep the existing Clean Table and DingMap export sections intact so the user can import Excel rows and then export the DingMap template through Task 003.

## Data Flow

```text
Excel file (.xlsx, <= 5 MB)
  -> API preview route
  -> ExcelJS workbook in memory
  -> selected worksheet
  -> generic raw import rows
  -> shared import pipeline
  -> preview rows
  -> Dashboard confirmation
  -> API import route
  -> server-side revalidation from raw rows
  -> raw_records + clean_markers
  -> Clean Table display
  -> existing Task 003 DingMap export
```

## Error Handling

Preview route errors:

* Missing file.
* File extension is not `.xlsx`.
* File larger than 5 MB.
* Workbook has no worksheets.
* Selected worksheet does not exist.
* First row has no usable headers.
* More than 1000 non-empty data rows.
* Workbook cannot be parsed.

Import route errors:

* Request body does not contain raw rows.
* Raw rows are malformed.
* Database write fails.

Import route still skips row-level `invalid` and `duplicate` records as nonfatal outcomes.

## Security And Privacy

* Do not commit uploaded Excel files.
* Do not commit generated upload files.
* Do not commit real addresses, real phone numbers, cookies, `.env`, `.auth`, `data/*.db`, `data/uploads/`, or `data/exports/`.
* Use only synthetic tests generated in memory.
* Upload filename is display-only after basename sanitization.
* Server-side import must not trust client status, merge key, or hash.

## Testing

Add tests for:

* In-memory `.xlsx` parsing with first-row headers.
* Chinese alias mapping through the shared import pipeline.
* Empty row skipping.
* Unrecognized columns preserved in `raw`.
* Phone normalization.
* Invalid row detection.
* Duplicate detection.
* Update candidate detection.
* Valid Excel row import into `clean_markers` with `source = 'excel'` and `originType = 'excel'`.
* Manual paste tests still passing after the refactor.
* Excel-imported Clean Markers are eligible for the existing Task 003 export query.
* File size and row count limits.

## Documentation

After implementation update:

* `docs/dev-log.md`
* `docs/task-cards/004-excel-to-clean-table.md`
* `docs/github-issues/task-004-issue.md`

README and `.agent` only change if a new long-term rule is introduced. This task does not currently introduce a new long-term rule beyond the existing no-sensitive-data and task-update rules.

## Out Of Scope

* No DingMap upload or login.
* No Playwright.
* No Youzhao or Jiepin collection.
* No OCR or image recognition.
* No no-header inference.
* No multi-sheet merge.
* No Task 003 template field changes.
* No database schema changes.
* No real Excel files or real business data in Git.
