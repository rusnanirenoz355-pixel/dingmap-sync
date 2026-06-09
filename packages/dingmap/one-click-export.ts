import ExcelJS from "exceljs";
import type { CleanMarker } from "@dingmap-sync/shared";
import {
  DINGMAP_IMPORT_HEADERS,
  mapCleanMarkerToDingmapImportRow,
} from "./export-template";

export function buildDingmapOneClickWorkbook(markers: CleanMarker[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");

  worksheet.columns = DINGMAP_IMPORT_HEADERS.map((header) => ({
    header,
    key: header,
    width: header === "备注" ? 48 : 20,
  }));

  markers.forEach((marker) => {
    worksheet.addRow(mapCleanMarkerToDingmapImportRow(marker));
  });

  worksheet.getRow(1).font = { bold: true };
  return workbook;
}

export interface DingmapExportFilenameOptions {
  platformLabel?: string;
  exportName?: string;
}

export function buildDingmapExportFilename(
  now = new Date(),
  options: DingmapExportFilenameOptions = {},
): string {
  const year = now.getFullYear();
  const month = padDatePart(now.getMonth() + 1);
  const day = padDatePart(now.getDate());
  const hour = padDatePart(now.getHours());
  const minute = padDatePart(now.getMinutes());
  const second = padDatePart(now.getSeconds());
  const timestamp = `${year}${month}${day}-${hour}${minute}${second}`;
  const segments = [sanitizeFilenameSegment(options.platformLabel), sanitizeFilenameSegment(options.exportName)]
    .filter((segment): segment is string => Boolean(segment))
    .map((segment) => truncateFilenameSegment(segment));

  if (segments.length === 0) {
    return `dingmap-import-${timestamp}.xlsx`;
  }

  return `dingmap-import-${segments.join("-")}-${timestamp}.xlsx`;
}

export async function writeDingmapOneClickExport(
  markers: CleanMarker[],
  outputPath: string,
): Promise<void> {
  const workbook = buildDingmapOneClickWorkbook(markers);
  await workbook.xlsx.writeFile(outputPath);
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function sanitizeFilenameSegment(value: unknown): string {
  return String(value ?? "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.+/g, "")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/\s*-\s*/g, "-")
    .trim()
    .replace(/^-+|-+$/g, "");
}

function truncateFilenameSegment(value: string): string {
  return value.length > 48 ? value.slice(0, 48).trim() : value;
}
