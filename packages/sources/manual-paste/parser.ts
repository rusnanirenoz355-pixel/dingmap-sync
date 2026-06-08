import { normalizeText } from "../../normalizer/normalize-text";
import {
  buildImportPreview,
  buildMergeKey,
  type ExistingMarkerFingerprint,
  type RawImportRow,
} from "../import-pipeline";
import type { ImportPreviewRow } from "../types";

export type ManualPasteRawRow = RawImportRow;
export { buildMergeKey, type ExistingMarkerFingerprint };

export function parseManualPasteText(inputText = ""): ManualPasteRawRow[] {
  const lines = inputText.replace(/\r/g, "").split("\n");
  const firstNonEmptyLine = lines.find((line) => line.trim().length > 0);

  if (!firstNonEmptyLine) {
    return [];
  }

  return firstNonEmptyLine.includes("\t") ? parseTsvRows(lines) : parseFieldTextRows(lines);
}

export function buildManualPastePreview(
  rows: ManualPasteRawRow[],
  existingMarkers = new Map<string, ExistingMarkerFingerprint>(),
): ImportPreviewRow[] {
  return buildImportPreview(rows, existingMarkers);
}

export function previewManualPasteText(
  inputText = "",
  existingMarkers = new Map<string, ExistingMarkerFingerprint>(),
): ImportPreviewRow[] {
  return buildManualPastePreview(parseManualPasteText(inputText), existingMarkers);
}

function parseTsvRows(lines: string[]): ManualPasteRawRow[] {
  const headerIndex = lines.findIndex((line) => line.trim().length > 0);
  if (headerIndex < 0) {
    return [];
  }

  const headers = lines[headerIndex]?.split("\t").map((header) => normalizeText(header)) ?? [];
  if (headers.every((header) => header.length === 0)) {
    return [];
  }

  return lines.slice(headerIndex + 1).flatMap((line, index) => {
    const cells = line.split("\t");
    if (isEmptyRow(cells)) {
      return [];
    }

    const raw = headers.reduce<Record<string, string>>((acc, header, headerCellIndex) => {
      if (header) {
        acc[header] = normalizeText(cells[headerCellIndex] ?? "");
      }
      return acc;
    }, {});

    return [
      {
        rowIndex: headerIndex + index + 2,
        source: "manual_paste",
        originType: "manual_paste",
        rawText: cells.join("\t"),
        raw,
      },
    ];
  });
}

function parseFieldTextRows(lines: string[]): ManualPasteRawRow[] {
  const rows: ManualPasteRawRow[] = [];
  let raw: Record<string, string> = {};
  let rawTextLines: string[] = [];
  let startLineIndex: number | null = null;

  lines.forEach((line, index) => {
    if (line.trim().length === 0) {
      flushFieldTextRow(rows, raw, rawTextLines, startLineIndex);
      raw = {};
      rawTextLines = [];
      startLineIndex = null;
      return;
    }

    const match = line.match(/^([^:：]+)[:：](.*)$/u);
    if (!match) {
      return;
    }

    const key = normalizeText(match[1]);
    if (!key) {
      return;
    }

    if (startLineIndex === null) {
      startLineIndex = index;
    }

    raw[key] = normalizeText(match[2]);
    rawTextLines.push(line);
  });

  flushFieldTextRow(rows, raw, rawTextLines, startLineIndex);
  return rows;
}

function flushFieldTextRow(
  rows: ManualPasteRawRow[],
  raw: Record<string, string>,
  rawTextLines: string[],
  startLineIndex: number | null,
): void {
  if (startLineIndex === null || Object.keys(raw).length === 0) {
    return;
  }

  rows.push({
    rowIndex: startLineIndex + 1,
    source: "manual_paste",
    originType: "manual_paste",
    rawText: rawTextLines.join("\n"),
    raw,
  });
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => normalizeText(cell).length === 0);
}
