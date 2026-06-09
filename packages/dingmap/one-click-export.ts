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
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = padDatePart(now.getHours());
  const minute = padDatePart(now.getMinutes());
  const timestamp = `${month}.${day}-${hour}.${minute}`;
  const platformLabel = truncateFilenameSegment(
    sanitizeFilenameSegment(options.platformLabel) || "面试点",
  );
  const exportName = truncateFilenameSegment(
    sanitizeFilenameSegment(options.exportName) || "未命名",
  );

  return `${platformLabel}-${exportName}-${timestamp}.xlsx`;
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
