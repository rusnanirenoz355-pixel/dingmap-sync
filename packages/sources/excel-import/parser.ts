import ExcelJS from "exceljs";
import type { ImportPreviewRow } from "@dingmap-sync/shared";
import {
  buildImportPreview,
  summarizePreviewRows,
  type ExistingMarkerFingerprint,
  type PreviewSummary,
  type RawImportRow,
} from "../import-pipeline";
import { normalizeText } from "../../normalizer/normalize-text";

export const MAX_EXCEL_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_EXCEL_DATA_ROWS = 1000;

export interface ExcelImportParseOptions {
  sheetName?: string;
  filename?: string;
  existingMarkers?: Map<string, ExistingMarkerFingerprint>;
}

export interface ExcelImportPreviewResult {
  filename?: string;
  sheetNames: string[];
  selectedSheetName: string;
  rawRows: RawImportRow[];
  rows: ImportPreviewRow[];
  summary: PreviewSummary;
}

export async function parseExcelImportWorkbook(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  options: ExcelImportParseOptions = {},
): Promise<ExcelImportPreviewResult> {
  const bytes = toBuffer(buffer);
  if (bytes.byteLength > MAX_EXCEL_UPLOAD_BYTES) {
    throw new Error("Excel file must be 5 MB or smaller.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  if (workbook.worksheets.length === 0) {
    throw new Error("Excel workbook has no worksheets.");
  }

  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  const worksheet = options.sheetName
    ? workbook.getWorksheet(options.sheetName)
    : workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("Selected worksheet does not exist.");
  }

  const headers = readHeaders(worksheet);
  if (headers.length === 0) {
    throw new Error("Excel worksheet headers are empty.");
  }

  const rawRows = readDataRows(worksheet, headers);
  const rows = buildImportPreview(rawRows, options.existingMarkers);

  return {
    filename: options.filename,
    sheetNames,
    selectedSheetName: worksheet.name,
    rawRows,
    rows,
    summary: summarizePreviewRows(rows),
  };
}

function toBuffer(input: Buffer | ArrayBuffer | Uint8Array): Buffer {
  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(input));
  }

  return Buffer.from(input);
}

function readHeaders(worksheet: ExcelJS.Worksheet): string[] {
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];

  for (let index = 1; index <= headerRow.cellCount; index += 1) {
    headers.push(normalizeText(headerRow.getCell(index).text));
  }

  return headers.filter((header) => header.length > 0);
}

function readDataRows(worksheet: ExcelJS.Worksheet, headers: string[]): RawImportRow[] {
  const rows: RawImportRow[] = [];

  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const values = headers.map((_, headerIndex) => normalizeText(row.getCell(headerIndex + 1).text));

    if (values.every((value) => value.length === 0)) {
      continue;
    }

    if (rows.length >= MAX_EXCEL_DATA_ROWS) {
      throw new Error(`Excel worksheet exceeds the ${MAX_EXCEL_DATA_ROWS} row limit.`);
    }

    const raw = headers.reduce<Record<string, string>>((acc, header, headerIndex) => {
      acc[header] = values[headerIndex] ?? "";
      return acc;
    }, {});

    rows.push({
      rowIndex,
      source: "excel",
      originType: "excel",
      rawText: values.join("\t"),
      raw,
    });
  }

  return rows;
}
