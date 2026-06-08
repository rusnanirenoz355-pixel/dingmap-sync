import type { CleanMarker } from "@dingmap-sync/shared";
import { buildDingmapDescription } from "./build-description";

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
    备注: buildDingmapDescription(marker),
    字段一: buildFieldOne(marker),
    字段二: buildFieldTwo(marker),
  };
}

function buildFieldOne(marker: Pick<CleanMarker, "stationManager" | "phone">): string {
  return `${marker.stationManager ?? ""}${marker.phone ?? ""}`;
}

function buildFieldTwo(marker: Pick<CleanMarker, "remark" | "interviewTime">): string {
  const remark = marker.remark?.trim();
  if (remark) {
    return remark;
  }

  return marker.interviewTime?.trim() ?? "";
}
