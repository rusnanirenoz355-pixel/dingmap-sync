export const ASSISTED_UPLOAD_STEPS = [
  "confirm-login-map",
  "find-layer",
  "open-layer-menu",
  "open-import-dialog",
  "confirm-add-data-tab",
  "confirm-style",
  "upload-file",
  "click-import",
  "wait-result",
] as const;

export type DingmapAssistedUploadStep = (typeof ASSISTED_UPLOAD_STEPS)[number];

export interface DingmapAssistedPromptContext {
  platformLabel: string;
  layerName: string;
  markerColorLabel: string;
}

export interface DingmapAssistSnapshot {
  step: DingmapAssistedUploadStep;
  url: string;
  title: string;
  screenshotPath?: string;
  debugPath?: string;
}

export function getNextAssistedUploadStep(
  step: DingmapAssistedUploadStep,
): DingmapAssistedUploadStep | null {
  const index = ASSISTED_UPLOAD_STEPS.indexOf(step);
  return ASSISTED_UPLOAD_STEPS[index + 1] ?? null;
}

export function buildAssistedUploadPrompt(
  step: DingmapAssistedUploadStep,
  context: DingmapAssistedPromptContext,
): string {
  switch (step) {
    case "confirm-login-map":
      return "请确认钉图已登录，并进入目标地图“面试点”。完成后点击继续。";
    case "find-layer":
      return `当前平台：${context.platformLabel}。请在左侧图层列表中找到“${context.layerName}”。如果没看到，请滚动左侧图层列表。找到后点击继续。`;
    case "open-layer-menu":
      return `请点击“${context.layerName}”这一行/卡片里的“更多”，不要点击其他图层的“更多”。点击后不要再操作，回到 Dashboard 点击继续。`;
    case "open-import-dialog":
      return "请点击弹出菜单里的“数据导入”。导入弹窗出现后，回到 Dashboard 点击继续。";
    case "confirm-add-data-tab":
      return "请确认当前处于“新增数据”页。如果不是，请点击“新增数据”，完成后点击继续。";
    case "confirm-style":
      return `请确认坐标类型为“火星坐标（高德/腾讯/谷歌）”，标记样式为“${context.markerColorLabel}”，标记大小为“小”。完成后点击继续。`;
    case "upload-file":
      return "系统将尝试通过文件输入框选择当前导出 Excel。完成后点击继续检查文件是否已选中。";
    case "click-import":
      return "请确认当前 Excel 文件已选中，然后点击钉图弹窗右下角“导入”。点击后等待页面提示，再回到 Dashboard 点击继续。";
    case "wait-result":
      return "系统将读取当前页面提示。若没有可靠成功或失败提示，会返回待人工确认。";
  }
}
