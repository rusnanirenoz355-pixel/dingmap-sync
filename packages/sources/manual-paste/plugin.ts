import type { DataSourcePlugin, ImportPreviewRow, ManualPasteCollectContext } from "../types";
import {
  buildManualPastePreview,
  parseManualPasteText,
  type ManualPasteRawRow,
} from "./parser";

export const manualPastePlugin: DataSourcePlugin<ManualPasteRawRow, ImportPreviewRow> = {
  sourceKey: "manual_paste",
  sourceName: "手动粘贴",
  startUrl: "manual://paste",
  loginRequired: false,
  async loginCheck() {
    return true;
  },
  async collect(context?: ManualPasteCollectContext) {
    return parseManualPasteText(context?.inputText);
  },
  async normalize(records: ManualPasteRawRow[]) {
    return buildManualPastePreview(records);
  },
};
