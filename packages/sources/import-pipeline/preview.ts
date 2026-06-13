import { buildMarkerHash } from "../../normalizer/build-marker-hash";
import { resolveFieldAlias, type NormalizedFieldName } from "../../normalizer/field-aliases";
import { normalizePhoneForImport } from "../../normalizer/normalize-phone";
import { normalizeText } from "../../normalizer/normalize-text";
import type { CleanMarker, ImportPreviewRow, ImportPreviewStatus } from "@dingmap-sync/shared";
import type { ExistingMarkerFingerprint, RawImportRow } from "./types";

export type { ExistingMarkerFingerprint, RawImportRow } from "./types";

export interface PreviewSummary {
  valid: number;
  invalid: number;
  duplicate: number;
  update_candidate: number;
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

export function buildImportPreview(
  rows: RawImportRow[],
  existingMarkers = new Map<string, ExistingMarkerFingerprint>(),
): ImportPreviewRow[] {
  return rows.map((row) => buildPreviewRow(row, existingMarkers));
}

export function summarizePreviewRows(rows: ImportPreviewRow[]): PreviewSummary {
  return rows.reduce(
    (summary, row) => {
      summary[row.status] += 1;
      return summary;
    },
    {
      valid: 0,
      invalid: 0,
      duplicate: 0,
      update_candidate: 0,
    } satisfies Record<ImportPreviewStatus, number>,
  );
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
  row: RawImportRow,
  existingMarkers: Map<string, ExistingMarkerFingerprint>,
): ImportPreviewRow {
  const warnings: string[] = [];
  const errors: string[] = [];
  const mapped = mapRawToMarker(row, warnings);

  if (row.source === "youzhao") {
    validateYouzhaoMarker(row, mapped, errors);
  } else if (!mapped.siteName && !mapped.address) {
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

  const mergeKey = buildRowMergeKey(row, mapped);
  if (!mergeKey) {
    errors.push(
      row.source === "youzhao"
        ? "无法生成 merge_key，需要优招 sourceId。"
        : "无法生成 merge_key，需要电话+地址、站点名称+地址或站点名称+电话。",
    );
  }

  const currentHash = errors.length === 0 ? buildMarkerHash(mapped) : null;
  const existing = mergeKey ? existingMarkers.get(mergeKey) : undefined;
  const status = resolveStatus(errors, currentHash, existing);

  return {
    rowIndex: row.rowIndex,
    source: row.source,
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
    targetLayer: normalizeText(row.raw.targetLayer) || null,
    dingmapRemark: normalizeText(row.raw.dingmapRemark) || null,
    dingmapFieldOne: normalizeText(row.raw.dingmapFieldOne) || null,
    dingmapFieldTwo: normalizeText(row.raw.dingmapFieldTwo) || null,
  };
}

function mapRawToMarker(row: RawImportRow, warnings: string[]): Partial<CleanMarker> {
  if (row.source === "youzhao") {
    return mapYouzhaoRawToMarker(row);
  }

  const headerMap = buildHeaderMap(Object.keys(row.raw), warnings);
  const marker: Partial<CleanMarker> = {
    source: row.source,
    originType: row.originType,
    syncAction: "review",
    syncStatus: "need_confirm",
  };

  for (const [field, header] of Object.entries(headerMap) as Array<[NormalizedFieldName, string]>) {
    const markerKey = FIELD_TO_MARKER_KEY[field];
    marker[markerKey] = normalizeText(row.raw[header]);
  }

  return marker;
}

function mapYouzhaoRawToMarker(row: RawImportRow): Partial<CleanMarker> {
  return {
    source: "youzhao",
    sourceId: resolveYouzhaoSourceId(row),
    originType: "web",
    siteName: normalizeText(row.raw["合作站点名称"]),
    address: normalizeText(row.raw["站点地址"]),
    longitude: null,
    latitude: null,
    stationManager: normalizeText(row.raw["站长姓名"]) || null,
    phone: normalizeText(row.raw["站长电话"]) || null,
    salary: normalizeText(row.raw["薪资方案"]) || null,
    welfare: normalizeText(row.raw["新人政策"]) || null,
    jobTitle: normalizeText(row.raw["岗位名称"]) || null,
    remark: normalizeText(row.raw["结算规则"]) || null,
    syncAction: "review",
    syncStatus: "need_confirm",
  };
}

function validateYouzhaoMarker(
  row: RawImportRow,
  marker: Partial<CleanMarker>,
  errors: string[],
): void {
  if (!marker.siteName) {
    errors.push("合作站点名称不能为空。");
  }

  if (!normalizeText(row.raw.jobId)) {
    errors.push("优招记录缺少 jobId，不能伪造 sourceId。");
  }

  if (!marker.sourceId) {
    errors.push("优招记录缺少 sourceId。");
  }

  if (!isYouzhaoRecruitingStatus(row.raw["招聘状态"])) {
    errors.push("优招记录不是招聘中状态。");
  }
}

function buildRowMergeKey(row: RawImportRow, marker: Partial<CleanMarker>): string | null {
  if (row.source === "youzhao") {
    return marker.sourceId ? `source_id:youzhao:${marker.sourceId}` : null;
  }

  return buildMergeKey(marker);
}

function resolveYouzhaoSourceId(row: RawImportRow): string | null {
  const siteId = normalizeText(row.raw.siteId);
  const jobId = normalizeText(row.raw.jobId);
  if (siteId && jobId) {
    return `${siteId}:${jobId}`;
  }
  return jobId || null;
}

function isYouzhaoRecruitingStatus(value: unknown): boolean {
  const normalized = normalizeText(value).replace(/\s+/g, "").toLowerCase();
  return normalized === "招聘中" || normalized === "1";
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

function normalizeForKey(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "").toLowerCase();
}

function resolveStatus(
  errors: string[],
  currentHash: string | null,
  existing?: ExistingMarkerFingerprint,
): ImportPreviewStatus {
  if (errors.length > 0 || !currentHash) {
    return "invalid";
  }

  if (!existing) {
    return "valid";
  }

  return existing.currentHash === currentHash ? "duplicate" : "update_candidate";
}
