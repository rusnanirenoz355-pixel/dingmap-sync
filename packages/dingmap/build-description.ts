import type { CleanMarker } from "@dingmap-sync/shared";

export function buildDingmapDescription(marker: Partial<CleanMarker>): string {
  const syncLines = [
    `来源：${marker.source ?? "未知"}`,
    marker.sourceId ? `来源 ID：${marker.sourceId}` : undefined,
    marker.jobTitle ? `岗位：${marker.jobTitle}` : undefined,
    marker.salary ? `薪资：${marker.salary}` : undefined,
    marker.welfare ? `福利：${marker.welfare}` : undefined,
    marker.stationManager ? `负责人：${marker.stationManager}` : undefined,
    marker.phone ? `电话：${marker.phone}` : undefined,
    marker.interviewTime ? `面试时间：${marker.interviewTime}` : undefined,
  ].filter((line): line is string => Boolean(line));

  return [
    "【系统同步信息】",
    ...syncLines,
    "",
    "【人工备注】",
    marker.remark?.trim() || "无",
  ].join("\n");
}
