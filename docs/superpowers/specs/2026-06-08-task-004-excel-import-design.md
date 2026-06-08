# Task 004 Field Text, TSV, And Excel Import Design

## Goal

Implement three Clean Table import entrances that share one preview, validation, dedupe, revalidation, and database import pipeline:

1. Field-name text paste in key-value blocks.
2. TSV / table paste with a header row.
3. `.xlsx` Excel upload with a header row.

Rows imported through any entrance must enter Clean Table first, then reuse the Task 003 DingMap template export layer. This task does not change the Task 003 seven-column DingMap template.

## Approved Scope

* Support key-value pasted text, with Chinese or English colons.
* Support multiple key-value records separated by blank lines.
* Support TSV / table paste with the first row as headers.
* Support `.xlsx` files with the first row as headers.
* Read the first worksheet by default and allow a selected worksheet name.
* Limit Excel uploads to 5 MB.
* Limit Excel parsed data rows to 1000.
* Parse Excel in memory by default; do not persist uploaded files.
* If a future fallback must write upload files, only use `data/uploads/` and delete files after import.
* Preserve unrecognized fields and columns in `raw`.
* Do not infer missing headers for TSV or Excel.
* Do not merge multiple worksheets.
* Do not support `.xls` or `.csv`.
* Do not do OCR, image recognition, DingMap upload, DingMap login, Playwright automation, external source collection, scheduled sync, or database schema changes.

## Existing System Fit

Task 002 currently implements manual paste as a complete vertical path:

* `packages/sources/manual-paste/parser.ts` parses TSV, maps aliases, validates rows, builds `mergeKey`, computes `currentHash`, and resolves preview status.
* `packages/sources/manual-paste/mapper.ts` maps preview rows to `CleanMarker`.
* `packages/db/manual-paste.ts` previews, revalidates, writes `raw_records`, inserts or updates `clean_markers`, and lists Clean Table rows.

Task 004 must split this path at the correct boundary: parsers convert input into raw rows, while preview status, validation, dedupe, server-side revalidation, and database writes become shared infrastructure.

Task 003 already provides the standard output layer. Task 004 must not modify DingMap template fields. It only needs to ensure imported Clean Markers use `sync_status = 'pending'` and `sync_action = 'create' | 'update'`, so they are eligible for the existing DingMap export query.

## Architecture

### Shared Import Pipeline

Create `packages/sources/import-pipeline/` for source-agnostic preview logic:

* `types.ts`: shared raw row input type with `source`, `originType`, `rowIndex`, `rawText`, and `raw`.
* `preview.ts`: convert raw rows into `ImportPreviewRow[]` using field aliases, phone normalization, required-field checks, merge key generation, hash generation, and duplicate/update detection.
* `mapper.ts`: map any valid or update preview row to `Partial<CleanMarker>` while preserving source and origin type.

The shared pipeline owns:

* Header/key alias resolution through existing `packages/normalizer/field-aliases.ts`.
* `siteName` / `address` / `phone` / `salary` / `welfare` / `stationManager` / `interviewTime` / `jobTitle` / `remark` mapping.
* Rule: `siteName` or `address` must exist.
* Rule: phone is optional, but if provided it must normalize to a reasonable 11-digit mainland China mobile number.
* Rule: empty address is a warning, not an error.
* Rule: a merge key must be generated from phone+address, site+address, or site+phone.
* Statuses: `valid`, `invalid`, `duplicate`, `update_candidate`.

### Parser Responsibilities

Parsers only convert input into raw rows. They do not validate business rules, compute hashes, inspect the database, or write records.

#### Field Text Parser

Extend or refactor `packages/sources/manual-paste/parser.ts` to support key-value field text:

* Accept lines such as `站点名称：值` or `address: value`.
* Support Chinese `：` and English `:`.
* Use blank lines to separate records.
* Skip empty blocks.
* Preserve unrecognized keys in `raw`.
* Produce one raw row per block with a stable `rowIndex` based on the block's starting line.
* Use `source = 'manual_paste'` and `originType = 'manual_paste'`.

#### TSV Parser

Keep Task 002 TSV behavior:

* First row is the header row.
* Rows are tab-separated.
* Empty rows are skipped.
* Unrecognized headers remain in `raw`.
* Use `source = 'manual_paste'` and `originType = 'manual_paste'`.

The manual paste preview entry chooses parser mode automatically:

* If the pasted text contains key-value blocks and no tabular header shape, parse as field text.
* If the pasted text contains a tab-separated first row, parse as TSV.

#### Excel Parser

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

## Shared Database Import

Create `packages/db/import-clean-markers.ts`.

Responsibilities:

* Load existing marker fingerprints by `merge_key`.
* Preview generic raw rows through the shared pipeline.
* Revalidate server-side during import from original raw rows.
* Ignore client-supplied `status`, `mergeKey`, and `currentHash`.
* Write `raw_records` using each row's source.
* Insert `valid` rows into `clean_markers`.
* Update `update_candidate` rows using the existing merge key.
* Skip `invalid` and `duplicate`.
* Return inserted, updated, duplicate, invalid, other skipped, update candidate, and Clean Table counts.

Manual paste DB functions remain public and compatible, but become wrappers over the shared DB import module. Their import path extracts only `raw`, `rowIndex`, `rawText`, `source`, and `originType`, then revalidates server-side. Excel DB functions call the same module with Excel raw rows.

## Import Behaviors

| Preview status | Import behavior |
| --- | --- |
| `valid` | Insert into `clean_markers` |
| `duplicate` | Skip |
| `invalid` | Skip |
| `update_candidate` | Update using the Task 002 merge-key rule |

Excel rows write `source = 'excel'` and `originType = 'excel'`.

Manual paste rows, including key-value field text and TSV, write `source = 'manual_paste'` and `originType = 'manual_paste'`.

## API

Create:

* `apps/dashboard/app/api/excel/preview/route.ts`
* `apps/dashboard/app/api/excel/import/route.ts`

Keep existing manual paste routes:

* `apps/dashboard/app/api/manual-paste/preview/route.ts`
* `apps/dashboard/app/api/manual-paste/import/route.ts`

Manual paste preview accepts text and returns preview rows for either key-value field text or TSV.

Excel preview accepts `multipart/form-data`:

* field `file`: required `.xlsx`
* field `sheetName`: optional

It validates filename extension, file size, and safe basename display. It parses in memory and returns:

* `filename`
* `sheetNames`
* `selectedSheetName`
* `rows`
* `summary`

Excel import accepts JSON with original raw rows from the preview response, not client-computed status. It revalidates on the server before writing to the database.

No API returns absolute filesystem paths. Any filename shown in UI is a sanitized basename only.

## Dashboard

Update the Dashboard with two import areas and keep the Task 003 export area intact:

### Paste Import

* Text area accepts key-value field text or TSV.
* Show supported source type after preview if useful: field text or TSV.
* Buttons: `生成预览`, `清空`, `导入 Clean Table`.
* Reuse the existing preview table and import result statistics.

### Excel Import

* File input for `.xlsx`.
* Display selected safe filename.
* Optional worksheet selector after preview.
* Buttons: `生成预览`, `清空`, `导入 Clean Table`.
* Preview table and result statistics.

### Shared UI Requirements

* Show `valid`, `invalid`, `duplicate`, and `update_candidate`.
* Use green for valid, red for invalid, gray for duplicate, and blue/yellow for update candidates.
* Keep OKX-light style: white background, light gray surfaces, black primary buttons, compact tables.
* Keep Clean Table visible.
* Keep Task 003 `导出钉图模板` button usable after imports.

## Data Flow

```text
Field text / TSV / Excel
  -> parser-specific raw rows
  -> shared import pipeline
  -> preview rows
  -> Dashboard confirmation
  -> import API with raw rows
  -> server-side revalidation
  -> raw_records + clean_markers
  -> Clean Table display
  -> existing Task 003 DingMap export
```

## Error Handling

Manual paste preview errors:

* Empty input.
* No parseable key-value blocks or TSV data rows.

Excel preview route errors:

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
* Do not commit real addresses, real phone numbers, cookies, accounts, `.env`, `.auth`, `data/*.db`, `data/uploads/`, or `data/exports/`.
* Use only synthetic tests generated in memory.
* Upload filename is display-only after basename sanitization.
* Server-side import must not trust client status, merge key, or hash.
* If temporary upload persistence is ever needed, it must stay under `data/uploads/` and be deleted after import.

## Testing

Add tests for:

* Key-value field text parsing with Chinese and English colons.
* Multiple key-value records separated by blank lines.
* TSV parsing with first-row headers.
* In-memory `.xlsx` parsing with first-row headers.
* Chinese alias mapping through the shared import pipeline.
* Empty row skipping.
* Unrecognized keys and columns preserved in `raw`.
* Phone normalization.
* Invalid row detection.
* Duplicate detection.
* Update candidate detection.
* Valid Excel row import into `clean_markers` with `source = 'excel'` and `originType = 'excel'`.
* Valid manual paste row import into `clean_markers` with `source = 'manual_paste'` and `originType = 'manual_paste'`.
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
* No `.xls` or `.csv`.
* No Task 003 template field changes.
* No database schema changes.
* No real Excel files or real business data in Git.
