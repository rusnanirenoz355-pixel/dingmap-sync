import { buildMarkerHash } from "../../normalizer/build-marker-hash";
import { resolveFieldAlias, type NormalizedFieldName } from "../../normalizer/field-aliases";
import { normalizePhoneForImport } from "../../normalizer/normalize-phone";
import { normalizeText } from "../../normalizer/normalize-text";
import type { CleanMarker, ImportPreviewRow } from "../types";

export interface ManualPasteRawRow {
  rowIndex: number;
  rawText: string;
  raw: Record<string, string>;
}

export interface ExistingMarkerFingerprint {
  id: number;
  currentHash: string | null;
}

type HeaderMap = Partial<Record<NormalizedFieldName, string>>;

const FIELD_TO_MARKER_KEY = {
  site_name: "siteName",
  address: "address",
  phone: "phone",
  salary: "salary",
  welfare: "welfare",
  station_manager: "stationManager",
  interview_time: "interviewTime",
  job_title: "jobTitle",
  remark: "remark",
} as const satisfies Record<NormalizedFieldName, keyof CleanMarker>;

export function parseManualPasteText(inputText = ""): ManualPasteRawRow[] {
  const rows = splitTsvRows(inputText);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0] ?? [];
  return rows.slice(1).flatMap((cells, index) => {
    if (isEmptyRow(cells)) {
      return [];
    }

    const raw = headers.reduce<Record<string, string>>((acc, header, headerIndex) => {
      const normalizedHeader = normalizeText(header);
      if (normalizedHeader) {
        acc[normalizedHeader] = normalizeText(cells[headerIndex] ?? "");
      }
      return acc;
    }, {});

    return [
      {
        rowIndex: index + 2,
        rawText: cells.join("\t"),
        raw,
      },
    ];
  });
}

export function buildManualPastePreview(
  rows: ManualPasteRawRow[],
  existingMarkers = new Map<string, ExistingMarkerFingerprint>(),
): ImportPreviewRow[] {
  return rows.map((row) => buildPreviewRow(row, existingMarkers));
}

export function previewManualPasteText(
  inputText = "",
  existingMarkers = new Map<string, ExistingMarkerFingerprint>(),
): ImportPreviewRow[] {
  return buildManualPastePreview(parseManualPasteText(inputText), existingMarkers);
}

export function buildMergeKey(marker: Partial<CleanMarker>): string | null {
  const siteName = normalizeForKey(marker.siteName);
  const address = normalizeForKey(marker.address);
  const phone = normalizePhoneForImport(marker.phone).primaryPhone;

  if (phone && address) {
    return `phone_address:${phone}:${address}`;
  }

  if (siteName && address) {
    return `site_address:${siteName}:${address}`;
  }

  if (siteName && phone) {
    return `site_phone:${siteName}:${phone}`;
  }

  return null;
}

function buildPreviewRow(
  row: ManualPasteRawRow,
  existingMarkers: Map<string, ExistingMarkerFingerprint>,
): ImportPreviewRow {
  const warnings: string[] = [];
  const errors: string[] = [];
  const mapped = mapRawToMarker(row.raw, warnings);

  if (!mapped.siteName && !mapped.address) {
    errors.push("站点名称或地址至少需要填写一个。");
  }

  if (!mapped.address) {
    warnings.push("地址为空，导入后可能需要人工补齐定位信息。");
  }

  const phoneResult = normalizePhoneForImport(mapped.phone);
  if (mapped.phone && !phoneResult.isValid) {
    errors.push("电话字段未识别到合理的 11 位中国大陆手机号。");
  }

  if (phoneResult.hasMultiple) {
    warnings.push("电话字段包含多个手机号，第一版仅使用第一个手机号参与去重。");
  }

  if (phoneResult.primaryPhone && !phoneResult.hasMultiple) {
    mapped.phone = phoneResult.primaryPhone;
  }

  const mergeKey = buildMergeKey(mapped);
  if (!mergeKey) {
    errors.push("无法生成 merge_key，需要电话+地址、站点名称+地址或站点名称+电话。");
  }

  const currentHash = errors.length === 0 ? buildMarkerHash(mapped) : null;
  const existing = mergeKey ? existingMarkers.get(mergeKey) : undefined;
  const status = resolveStatus(errors, currentHash, existing);

  return {
    rowIndex: row.rowIndex,
    source: "manual_paste",
    rawText: row.rawText,
    raw: row.raw,
    mapped,
    normalized: mapped,
    status,
    errors,
    warnings,
    mergeKey,
    currentHash,
    existingMarkerId: existing?.id ?? null,
    parseStatus: status === "invalid" ? "failed" : "parsed",
  };
}

function mapRawToMarker(raw: Record<string, string>, warnings: string[]): Partial<CleanMarker> {
  const headerMap = buildHeaderMap(Object.keys(raw), warnings);
  const marker: Partial<CleanMarker> = {
    source: "manual_paste",
    originType: "manual_paste",
    syncAction: "review",
    syncStatus: "need_confirm",
  };

  for (const [field, header] of Object.entries(headerMap) as Array<[NormalizedFieldName, string]>) {
    const markerKey = FIELD_TO_MARKER_KEY[field];
    marker[markerKey] = normalizeText(raw[header]);
  }

  return marker;
}

function buildHeaderMap(headers: string[], warnings: string[]): HeaderMap {
  const headerMap: HeaderMap = {};

  for (const header of headers) {
    const field = resolveFieldAlias(header);
    if (!field) {
      continue;
    }

    if (headerMap[field]) {
      warnings.push(`字段 ${field} 存在重复表头，已使用第一个表头。`);
      continue;
    }

    headerMap[field] = header;
  }

  return headerMap;
}

function splitTsvRows(inputText: string): string[][] {
  return inputText
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, ""))
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split("\t"));
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((cell) => normalizeText(cell).length === 0);
}

function normalizeForKey(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "").toLowerCase();
}

function resolveStatus(
  errors: string[],
  currentHash: string | null,
  existing?: ExistingMarkerFingerprint,
) {
  if (errors.length > 0 || !currentHash) {
    return "invalid";
  }

  if (!existing) {
    return "valid";
  }

  return existing.currentHash === currentHash ? "duplicate" : "update_candidate";
}
