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

export function buildDingmapExportFilename(now = new Date()): string {
  const year = now.getFullYear();
  const month = padDatePart(now.getMonth() + 1);
  const day = padDatePart(now.getDate());
  const hour = padDatePart(now.getHours());
  const minute = padDatePart(now.getMinutes());
  const second = padDatePart(now.getSeconds());

  return `dingmap-import-${year}${month}${day}-${hour}${minute}${second}.xlsx`;
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
