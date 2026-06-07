import type { CleanMarker } from "@dingmap-sync/shared";

export async function createMarkerByBrowserAutomation(_marker: CleanMarker) {
  return {
    status: "skipped" as const,
    reason: "备用方案占位：第一版不做钉图真实逐条录入。",
  };
}
