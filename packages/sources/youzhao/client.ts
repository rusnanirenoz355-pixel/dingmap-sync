import { buildImportPreview, summarizePreviewRows, type RawImportRow } from "../import-pipeline";
import { mapYouzhaoJobsToRawRows, type YouzhaoRawRow } from "./mapper";

export type YouzhaoApiStatus =
  | "success"
  | "requires_login"
  | "forbidden"
  | "schema_changed"
  | "blocked"
  | "timeout"
  | "auth_mechanism_unknown"
  | "auth_failed"
  | "failed";

export interface YouzhaoQueryInput {
  city?: unknown;
  page?: unknown;
  pageSize?: unknown;
  limit?: unknown;
  recruitmentStatus?: unknown;
}

export interface YouzhaoQuery {
  city: string;
  page: number;
  pageSize: number;
  limit: number;
  recruitmentStatus: "招聘中";
}

export interface YouzhaoClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  headers?: HeadersInit;
  timeoutMs?: number;
}

export interface YouzhaoRequestDiagnostics {
  requestMode?: string;
  httpStatus?: number;
  contentType?: string;
}

export interface YouzhaoFetchResult {
  status: YouzhaoApiStatus;
  method: "GET";
  endpoint: string;
  params: Record<string, string>;
  total: number | null;
  items: YouzhaoRawRow[];
  rawReturned: number;
  filteredNonRecruiting: number;
  diagnostics?: YouzhaoRequestDiagnostics;
  message?: string;
}

export interface YouzhaoProbeResult extends Omit<YouzhaoFetchResult, "items"> {
  returned: number;
  sampleFields: string[];
}

export interface YouzhaoPreviewResult extends YouzhaoFetchResult {
  rawRows: RawImportRow[];
  rows: ReturnType<typeof buildImportPreview>;
  summary: ReturnType<typeof summarizePreviewRows>;
}

export interface YouzhaoAccessCheckResult {
  status: YouzhaoApiStatus;
  method: "GET";
  endpoint: string;
  params: Record<string, string>;
  total: number | null;
  diagnostics?: YouzhaoRequestDiagnostics;
  message?: string;
}

export class YouzhaoValidationError extends Error {
  readonly status: YouzhaoApiStatus = "failed";
}

export const YOUZHAO_API_BASE_URL = "https://hr.qingz.xyz";
export const YOUZHAO_POSITIONS_ENDPOINT = "/api/positions";
export const YOUZHAO_RECRUITING_STATUS_PARAM = "1";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_LIMIT = 50;
const DEFAULT_TIMEOUT_MS = 15_000;

export function normalizeYouzhaoQuery(input: YouzhaoQueryInput): YouzhaoQuery {
  const city = normalizeCity(input.city);
  const page = normalizeInteger(input.page, DEFAULT_PAGE, "page");
  const pageSize = normalizeInteger(input.pageSize, DEFAULT_PAGE_SIZE, "pageSize");
  const limit = normalizeInteger(input.limit, DEFAULT_LIMIT, "limit");
  const recruitmentStatus = input.recruitmentStatus;

  if (page < 1) {
    throw new YouzhaoValidationError("page 必须大于等于 1。");
  }
  if (pageSize < 1 || pageSize > 50) {
    throw new YouzhaoValidationError("pageSize 必须在 1 到 50 之间。");
  }
  if (limit < 20 || limit > 100) {
    throw new YouzhaoValidationError("limit 必须在 20 到 100 之间。");
  }
  if (
    recruitmentStatus !== undefined &&
    String(recruitmentStatus).trim() !== "" &&
    String(recruitmentStatus).trim() !== "招聘中"
  ) {
    throw new YouzhaoValidationError("recruitmentStatus 固定为招聘中。");
  }

  return {
    city,
    page,
    pageSize,
    limit,
    recruitmentStatus: "招聘中",
  };
}

export async function fetchYouzhaoRecruitingJobs(
  input: YouzhaoQueryInput,
  options: YouzhaoClientOptions = {},
): Promise<YouzhaoFetchResult> {
  const query = normalizeYouzhaoQuery(input);
  const fetchImpl = options.fetchImpl ?? fetch;
  const collected: YouzhaoRawRow[] = [];
  let page = query.page;
  let total: number | null = null;
  let lastParams = buildPositionsParams({ ...query, page });
  let lastDiagnostics: YouzhaoRequestDiagnostics | undefined;

  while (collected.length < query.limit) {
    const params = buildPositionsParams({ ...query, page });
    lastParams = params;
    const response = await fetchYouzhaoPage(params, fetchImpl, options);
    lastDiagnostics = response.diagnostics;
    if (response.status !== "success") {
      return {
        status: response.status,
        method: "GET",
        endpoint: YOUZHAO_POSITIONS_ENDPOINT,
        params,
        total: null,
        items: [],
        rawReturned: 0,
        filteredNonRecruiting: 0,
        diagnostics: response.diagnostics,
        message: response.message,
      };
    }

    total = response.total;
    collected.push(...response.items);
    if (response.items.length < query.pageSize || collected.length >= query.limit) {
      break;
    }
    page += 1;
  }

  const limited = collected.slice(0, query.limit);
  const mapped = mapYouzhaoJobsToRawRows(limited, { city: query.city });

  return {
    status: "success",
    method: "GET",
    endpoint: YOUZHAO_POSITIONS_ENDPOINT,
    params: lastParams,
    total,
    items: limited,
    rawReturned: limited.length,
    filteredNonRecruiting: mapped.filteredNonRecruiting,
    diagnostics: lastDiagnostics,
  };
}

export async function probeYouzhaoPositions(
  input: YouzhaoQueryInput,
  options: YouzhaoClientOptions = {},
): Promise<YouzhaoProbeResult> {
  const result = await fetchYouzhaoRecruitingJobs(input, options);
  return {
    ...result,
    returned: result.items.length,
    sampleFields: Array.from(new Set(result.items.flatMap((item) => Object.keys(item)))).sort(),
  };
}

export async function previewYouzhaoPositions(
  input: YouzhaoQueryInput,
  options: YouzhaoClientOptions = {},
): Promise<YouzhaoPreviewResult> {
  const result = await fetchYouzhaoRecruitingJobs(input, options);
  const query = normalizeYouzhaoQuery(input);
  const mapped = result.status === "success" ? mapYouzhaoJobsToRawRows(result.items, { city: query.city }) : {
    rows: [],
    filteredNonRecruiting: 0,
  };
  const rows = buildImportPreview(mapped.rows);

  return {
    ...result,
    filteredNonRecruiting: mapped.filteredNonRecruiting,
    rawRows: mapped.rows,
    rows,
    summary: summarizePreviewRows(rows),
  };
}

export async function checkYouzhaoPositionsAccess(
  input: YouzhaoQueryInput,
  options: YouzhaoClientOptions = {},
): Promise<YouzhaoAccessCheckResult> {
  const query = normalizeYouzhaoQuery({
    ...input,
    page: 1,
    pageSize: 1,
    limit: 20,
  });
  const params = buildPositionsParams({ ...query, page: 1, pageSize: 1 });
  const response = await fetchYouzhaoPage(params, options.fetchImpl ?? fetch, options);

  return {
    status: response.status,
    method: "GET",
    endpoint: YOUZHAO_POSITIONS_ENDPOINT,
    params,
    total: response.total,
    diagnostics: response.diagnostics,
    message: response.message,
  };
}

function normalizeCity(value: unknown): string {
  if (Array.isArray(value)) {
    throw new YouzhaoValidationError("一次只能指定一个城市。");
  }

  const city = typeof value === "string" ? value.trim() : "";
  if (!city) {
    throw new YouzhaoValidationError("必须选择一个城市。");
  }
  if (city.includes(",") || city.includes("，") || city === "全国" || city === "全国全部") {
    throw new YouzhaoValidationError("一次只能指定一个城市。");
  }
  return city;
}

function normalizeInteger(value: unknown, fallback: number, field: string): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue)) {
    throw new YouzhaoValidationError(`${field} 必须是整数。`);
  }
  return numberValue;
}

function buildPositionsParams(query: YouzhaoQuery): Record<string, string> {
  return {
    page: String(query.page),
    pageSize: String(query.pageSize),
    city: query.city,
    status: YOUZHAO_RECRUITING_STATUS_PARAM,
  };
}

async function fetchYouzhaoPage(
  params: Record<string, string>,
  fetchImpl: typeof fetch,
  options: YouzhaoClientOptions,
): Promise<{
  status: YouzhaoApiStatus;
  total: number | null;
  items: YouzhaoRawRow[];
  diagnostics?: YouzhaoRequestDiagnostics;
  message?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const url = new URL(YOUZHAO_POSITIONS_ENDPOINT, options.baseUrl ?? YOUZHAO_API_BASE_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: options.headers,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const diagnostics = buildResponseDiagnostics(response, contentType);
    const authStatus = response.headers.get("x-dingmap-youzhao-auth-status");

    if (response.status === 401) {
      return {
        status: authStatus === "auth_failed" || authStatus === "auth_mechanism_unknown"
          ? authStatus
          : "requires_login",
        total: null,
        items: [],
        diagnostics,
      };
    }
    if (response.status === 403) {
      return { status: "forbidden", total: null, items: [], diagnostics };
    }
    if (response.status === 429) {
      return { status: "blocked", total: null, items: [], diagnostics };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? "";
      return {
        status: looksLikeLoginRedirect(location) ? "requires_login" : "failed",
        total: null,
        items: [],
        diagnostics,
        message: `HTTP ${response.status}`,
      };
    }
    if (!response.ok) {
      return { status: "failed", total: null, items: [], diagnostics, message: `HTTP ${response.status}` };
    }

    const body = await response.text();
    if (looksLikeLoginHtml(body, contentType)) {
      return { status: "requires_login", total: null, items: [], diagnostics };
    }
    if (looksLikeHtml(body, contentType)) {
      return { status: "schema_changed", total: null, items: [], diagnostics };
    }

    const payload = parseJsonBody(body);
    const parsed = parsePositionsPayload(payload);
    if (!parsed) {
      return { status: "schema_changed", total: null, items: [], diagnostics };
    }
    return {
      status: "success",
      total: parsed.total,
      items: parsed.items,
      diagnostics,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { status: "timeout", total: null, items: [] };
    }
    return {
      status: "failed",
      total: null,
      items: [],
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonBody(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function buildResponseDiagnostics(response: Response, contentType: string): YouzhaoRequestDiagnostics {
  return {
    requestMode: response.headers.get("x-dingmap-youzhao-request-mode") ?? undefined,
    httpStatus: response.status,
    contentType: contentType || undefined,
  };
}

function looksLikeLoginRedirect(location: string): boolean {
  return /login|signin|auth/i.test(location);
}

function looksLikeLoginHtml(body: string, contentType: string): boolean {
  return looksLikeHtml(body, contentType) && /login|signin|password|captcha|<form/i.test(body);
}

function looksLikeHtml(body: string, contentType: string): boolean {
  return contentType.toLowerCase().includes("text/html") || /^\s*<!doctype html|^\s*<html/i.test(body);
}

function parsePositionsPayload(payload: unknown): { items: YouzhaoRawRow[]; total: number | null } | null {
  if (!isRecord(payload)) {
    return null;
  }

  const itemsValue = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.items)
      ? payload.items
      : null;
  if (!itemsValue) {
    return null;
  }

  const total = isRecord(payload.pagination) && typeof payload.pagination.total === "number"
    ? payload.pagination.total
    : typeof payload.total === "number"
      ? payload.total
      : null;

  return {
    items: itemsValue.filter(isRecord) as YouzhaoRawRow[],
    total,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
