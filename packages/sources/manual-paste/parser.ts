import type { ImportPreviewRow } from "../types";

export interface ManualPasteRawRow {
  rowIndex: number;
  text: string;
}

export function parseManualPasteText(inputText = ""): ManualPasteRawRow[] {
  return inputText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      rowIndex: index + 1,
      text,
    }));
}

export function buildManualPastePreview(rows: ManualPasteRawRow[]): ImportPreviewRow[] {
  return rows.map((row) => ({
    rowIndex: row.rowIndex,
    source: "manual_paste",
    rawText: row.text,
    normalized: {
      source: "manual_paste",
      siteName: row.text,
      address: "",
      originType: "manual_paste",
      syncAction: "review",
      syncStatus: "need_confirm",
    },
    parseStatus: "pending",
    warnings: ["第一版仅做占位预览，后续任务实现字段识别。"],
  }));
}
