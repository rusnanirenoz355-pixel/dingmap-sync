import ExcelJS from "exceljs";
import type { CleanMarker } from "@dingmap-sync/shared";
import { buildDingmapDescription } from "./build-description";

export function buildDingmapOneClickWorkbook(markers: CleanMarker[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("dingmap-one-click");

  worksheet.columns = [
    { header: "站点名称", key: "siteName", width: 24 },
    { header: "地址", key: "address", width: 36 },
    { header: "经度", key: "longitude", width: 14 },
    { header: "纬度", key: "latitude", width: 14 },
    { header: "电话", key: "phone", width: 18 },
    { header: "描述", key: "description", width: 48 },
  ];

  markers.forEach((marker) => {
    worksheet.addRow({
      siteName: marker.siteName,
      address: marker.address,
      longitude: marker.longitude ?? "",
      latitude: marker.latitude ?? "",
      phone: marker.phone ?? "",
      description: buildDingmapDescription(marker),
    });
  });

  worksheet.getRow(1).font = { bold: true };
  return workbook;
}

export async function writeDingmapOneClickExport(
  markers: CleanMarker[],
  outputPath: string,
): Promise<void> {
  const workbook = buildDingmapOneClickWorkbook(markers);
  await workbook.xlsx.writeFile(outputPath);
}
