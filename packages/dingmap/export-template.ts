import type { CleanMarker } from "@dingmap-sync/shared";

export const DINGMAP_IMPORT_HEADERS = [
  "标记名称",
  "详细地址",
  "经度",
  "纬度",
  "备注",
  "字段一",
  "字段二",
] as const;

export type DingmapImportHeader = (typeof DINGMAP_IMPORT_HEADERS)[number];

export type DingmapImportRow = Record<DingmapImportHeader, string | number>;

export function mapCleanMarkerToDingmapImportRow(marker: CleanMarker): DingmapImportRow {
  return {
    标记名称: marker.siteName,
    详细地址: marker.address,
    经度: marker.longitude ?? "",
    纬度: marker.latitude ?? "",
    备注: cleanText(marker.salary),
    字段一: buildFieldOne(marker),
    字段二: buildFieldTwo(marker),
  };
}

function buildFieldOne(marker: Pick<CleanMarker, "stationManager" | "phone">): string {
  const stationManager = cleanText(marker.stationManager);
  const phone = cleanText(marker.phone);

  if (stationManager && phone) {
    return `${stationManager} ${phone}`;
  }

  if (stationManager) {
    return stationManager;
  }

  if (phone) {
    return phone;
  }

  return "";
}

function buildFieldTwo(marker: Pick<CleanMarker, "remark">): string {
  return cleanText(marker.remark);
}

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}
