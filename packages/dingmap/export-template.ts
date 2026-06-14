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
  if (marker.source === "youzhao") {
    return mapYouzhaoCleanMarkerToDingmapImportRow(marker);
  }

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

function mapYouzhaoCleanMarkerToDingmapImportRow(marker: CleanMarker): DingmapImportRow {
  return {
    标记名称: marker.siteName,
    详细地址: marker.address,
    经度: "",
    纬度: "",
    备注: buildYouzhaoRemark(marker),
    字段一: [marker.stationManager?.trim(), marker.phone?.trim()].filter(Boolean).join(" "),
    字段二: marker.remark?.trim() ?? "",
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

function buildYouzhaoRemark(marker: Pick<CleanMarker, "jobTitle" | "salary" | "welfare">): string {
  const sections = [
    ["岗位名称", marker.jobTitle?.trim()],
    ["薪资方案", marker.salary?.trim()],
    ["新人政策", marker.welfare?.trim()],
  ].filter((section): section is [string, string] => Boolean(section[1]));

  return sections.map(([title, value]) => `【${title}】\n${value}`).join("\n\n");
}
