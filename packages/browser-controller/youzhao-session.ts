import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext } from "playwright";
import {
  checkYouzhaoPositionsAccess,
  type YouzhaoApiStatus,
  type YouzhaoQueryInput,
} from "../sources/youzhao/client";

export const YOUZHAO_LOGIN_URL = "https://hr.qingz.xyz/push/records";
export const YOUZHAO_PROFILE_RELATIVE_DIR = "data/browser-profile/youzhao";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_TIMEOUT_MS = 15_000;
const SESSION_CHECK_CITY = "\u4e0a\u6d77";
const YOUZHAO_HOST = "hr.qingz.xyz";

export type YouzhaoSessionStatus =
  | "opened"
  | "authenticated"
  | "requires_login"
  | "forbidden"
  | "blocked"
  | "timeout"
  | "schema_changed"
  | "failed";

export type YouzhaoRequestMode = "page-fetch" | "context-request";

export interface YouzhaoSessionDiagnostics {
  sessionFound: boolean;
  contextClosed: boolean;
  pageCount: number;
  youzhaoPageFound: boolean;
  youzhaoPageUrl?: string;
  requestMode?: YouzhaoRequestMode;
  httpStatus?: number;
  contentType?: string;
  responseUrl?: string;
  finalStatus?: YouzhaoSessionStatus;
}

export interface YouzhaoSessionResult {
  status: YouzhaoSessionStatus;
  authenticated: boolean;
  pageDetected?: boolean;
  profileDir?: string;
  message?: string;
  diagnostics?: YouzhaoSessionDiagnostics;
}

interface ContextRequest {
  get(url: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<{
    status(): number;
    headers(): Record<string, string>;
    body(): Promise<Buffer>;
  }>;
}

interface PageFetchResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  url?: string;
}

export interface YouzhaoPersistentPage {
  bringToFront?: () => Promise<void>;
  evaluate?: (
    pageFunction: (arg: { path: string; headers: Record<string, string> }) => PageFetchResult | Promise<PageFetchResult>,
    arg: { path: string; headers: Record<string, string> },
  ) => Promise<PageFetchResult>;
  goto: (url: string, options?: { waitUntil?: "domcontentloaded"; timeout?: number }) => Promise<unknown>;
  url?: () => string;
}

export interface YouzhaoPersistentContext {
  pages: () => YouzhaoPersistentPage[];
  newPage: () => Promise<YouzhaoPersistentPage>;
  request: ContextRequest;
}

export interface YouzhaoSessionAdapter {
  launchPersistentContext: (
    profileDir: string,
    options: { headless: boolean },
  ) => Promise<YouzhaoPersistentContext>;
}

export interface YouzhaoSessionOptions {
  adapter?: YouzhaoSessionAdapter;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface YouzhaoSessionStore {
  activeContext: YouzhaoPersistentContext | null;
  lastDiagnostics: YouzhaoSessionDiagnostics | null;
}

declare global {
  // Persist across Next dev route recompiles inside the same Node process.
  var __dingmapYouzhaoSession: YouzhaoSessionStore | undefined;
}

const defaultAdapter: YouzhaoSessionAdapter = {
  async launchPersistentContext(profileDir, options) {
    return chromium.launchPersistentContext(profileDir, options) as Promise<BrowserContext> as Promise<YouzhaoPersistentContext>;
  },
};

export function resolveYouzhaoProfileDir(): string {
  return resolve(PROJECT_ROOT, YOUZHAO_PROFILE_RELATIVE_DIR);
}

export async function openYouzhaoLoginSession(
  options: YouzhaoSessionOptions = {},
): Promise<YouzhaoSessionResult> {
  const profileDir = resolveYouzhaoProfileDir();
  mkdirSync(profileDir, { recursive: true });

  const adapter = options.adapter ?? defaultAdapter;
  const store = getSessionStore();
  let activeContext = await getOrCreateContext(store, adapter, profileDir);
  let page: YouzhaoPersistentPage;
  try {
    page = await resolveYouzhaoLoginPage(activeContext);
  } catch (error) {
    if (!isClosedContextError(error)) {
      throw error;
    }
    store.activeContext = null;
    activeContext = await getOrCreateContext(store, adapter, profileDir);
    page = await resolveYouzhaoLoginPage(activeContext);
  }

  await page.bringToFront?.();
  const pageDetected = isYouzhaoPage(page);
  if (!pageDetected) {
    await page.goto(YOUZHAO_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  const diagnostics = inspectContext(activeContext);
  store.lastDiagnostics = diagnostics;

  return {
    status: "opened",
    authenticated: false,
    pageDetected: pageDetected || isYouzhaoPage(page),
    profileDir: YOUZHAO_PROFILE_RELATIVE_DIR,
    diagnostics: diagnosticsForEnvironment(diagnostics),
  };
}

export async function checkYouzhaoLoginSession(
  _input: YouzhaoQueryInput,
  options: YouzhaoSessionOptions = {},
): Promise<YouzhaoSessionResult> {
  const fetchImpl = options.fetchImpl ?? fetchWithYouzhaoSession;
  const result = await checkYouzhaoPositionsAccess(
    { city: SESSION_CHECK_CITY, page: 1, pageSize: 1, limit: 20 },
    {
      fetchImpl,
      timeoutMs: options.timeoutMs,
    },
  );
  const status = result.status === "success"
    ? "authenticated"
    : mapClientStatusToSessionStatus(result.status);
  const diagnostics = withFinalStatus(getSessionStore().lastDiagnostics, status);

  if (result.status === "success") {
    return {
      status,
      authenticated: true,
      pageDetected: hasYouzhaoPage(getSessionStore().activeContext),
      diagnostics: diagnosticsForEnvironment(diagnostics),
    };
  }

  return {
    status,
    authenticated: false,
    pageDetected: hasYouzhaoPage(getSessionStore().activeContext),
    message: result.message,
    diagnostics: diagnosticsForEnvironment(diagnostics),
  };
}

export async function fetchWithYouzhaoSession(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return requestYouzhaoApiFromAuthenticatedPage(input, init);
}

export async function requestYouzhaoApiFromAuthenticatedPage(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  if (init.method && init.method.toUpperCase() !== "GET") {
    throw new Error("Youzhao authenticated requests only allow GET.");
  }

  const store = getSessionStore();
  const activeContext = store.activeContext;
  if (!activeContext) {
    store.lastDiagnostics = inspectContext(null);
    throw new Error("Open the youzhao login window and finish manual login first.");
  }

  const initialDiagnostics = inspectContext(activeContext);
  if (initialDiagnostics.contextClosed) {
    store.activeContext = null;
    store.lastDiagnostics = initialDiagnostics;
    throw new Error("The youzhao browser context is closed. Reopen the login window.");
  }

  const youzhaoPage = safeFindYouzhaoPage(activeContext);
  if (youzhaoPage?.evaluate) {
    try {
      const pageResponse = await requestFromYouzhaoPage(
        youzhaoPage,
        input,
        buildPageFetchHeaders(init.headers),
        DEFAULT_TIMEOUT_MS,
      );
      const diagnostics: YouzhaoSessionDiagnostics = {
        ...initialDiagnostics,
        requestMode: "page-fetch",
        httpStatus: pageResponse.status,
        contentType: headerValue(pageResponse.headers, "content-type"),
        responseUrl: sanitizeUrlPath(pageResponse.url),
      };
      store.lastDiagnostics = diagnostics;
      const responseHeaders = new Headers(pageResponse.headers);
      responseHeaders.set("x-dingmap-youzhao-request-mode", "page-fetch");
      return new Response(pageResponse.body, {
        status: pageResponse.status,
        headers: responseHeaders,
      });
    } catch (error) {
      if (!isPageFetchUnavailableError(error)) {
        throw error;
      }
    }
  }

  const apiResponse = await activeContext.request.get(String(input), {
    headers: headersToRecord(init.headers),
    timeout: DEFAULT_TIMEOUT_MS,
  });
  const body = await apiResponse.body();
  const responseHeaders = apiResponse.headers();
  store.lastDiagnostics = {
    ...initialDiagnostics,
    requestMode: "context-request",
    httpStatus: apiResponse.status(),
    contentType: headerValue(responseHeaders, "content-type"),
  };
  responseHeaders["x-dingmap-youzhao-request-mode"] = "context-request";
  return new Response(new Uint8Array(body), {
    status: apiResponse.status(),
    headers: responseHeaders,
  });
}

export function resetYouzhaoSessionForTests(): void {
  const store = getSessionStore();
  store.activeContext = null;
  store.lastDiagnostics = null;
}

function getSessionStore(): YouzhaoSessionStore {
  globalThis.__dingmapYouzhaoSession ??= { activeContext: null, lastDiagnostics: null };
  return globalThis.__dingmapYouzhaoSession;
}

async function getOrCreateContext(
  store: YouzhaoSessionStore,
  adapter: YouzhaoSessionAdapter,
  profileDir: string,
): Promise<YouzhaoPersistentContext> {
  store.activeContext ??= await adapter.launchPersistentContext(profileDir, { headless: false });
  return store.activeContext;
}

async function resolveYouzhaoLoginPage(
  context: YouzhaoPersistentContext,
): Promise<YouzhaoPersistentPage> {
  return findYouzhaoPage(context.pages()) ?? context.pages()[0] ?? context.newPage();
}

async function requestFromYouzhaoPage(
  page: YouzhaoPersistentPage,
  input: RequestInfo | URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<PageFetchResult> {
  const path = toYouzhaoRelativePath(input);
  return withRequestTimeout(
    page.evaluate!(
      async ({ path: requestPath, headers: requestHeaders }) => {
        const response = await fetch(requestPath, {
          method: "GET",
          credentials: "include",
          headers: requestHeaders,
        });
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: await response.text(),
          url: response.url,
        };
      },
      { path, headers },
    ),
    timeoutMs,
  );
}

function toYouzhaoRelativePath(input: RequestInfo | URL): string {
  const url = new URL(String(input), `https://${YOUZHAO_HOST}`);
  if (url.hostname !== YOUZHAO_HOST) {
    throw new Error("Only hr.qingz.xyz API requests are allowed.");
  }
  return `${url.pathname}${url.search}`;
}

async function withRequestTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new DOMException("Timeout", "AbortError")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function findYouzhaoPage(pages: YouzhaoPersistentPage[]): YouzhaoPersistentPage | null {
  return pages.find(isYouzhaoPage) ?? null;
}

function safeFindYouzhaoPage(context: YouzhaoPersistentContext): YouzhaoPersistentPage | null {
  try {
    return findYouzhaoPage(context.pages());
  } catch (error) {
    if (isClosedContextError(error)) {
      return null;
    }
    throw error;
  }
}

function hasYouzhaoPage(context: YouzhaoPersistentContext | null): boolean {
  if (!context) {
    return false;
  }
  try {
    return Boolean(findYouzhaoPage(context.pages()));
  } catch (error) {
    if (isClosedContextError(error)) {
      return false;
    }
    throw error;
  }
}

function inspectContext(context: YouzhaoPersistentContext | null): YouzhaoSessionDiagnostics {
  const diagnostics: YouzhaoSessionDiagnostics = {
    sessionFound: Boolean(context),
    contextClosed: false,
    pageCount: 0,
    youzhaoPageFound: false,
  };
  if (!context) {
    return diagnostics;
  }
  try {
    const pages = context.pages();
    const youzhaoPage = findYouzhaoPage(pages);
    return {
      ...diagnostics,
      pageCount: pages.length,
      youzhaoPageFound: Boolean(youzhaoPage),
      youzhaoPageUrl: sanitizePageUrl(youzhaoPage),
    };
  } catch (error) {
    if (isClosedContextError(error)) {
      return {
        ...diagnostics,
        contextClosed: true,
      };
    }
    throw error;
  }
}

function isYouzhaoPage(page: YouzhaoPersistentPage): boolean {
  const url = page.url?.() ?? "";
  try {
    return new URL(url).hostname === YOUZHAO_HOST;
  } catch {
    return false;
  }
}

function sanitizePageUrl(page: YouzhaoPersistentPage | null): string | undefined {
  return sanitizeUrlPath(page?.url?.());
}

function sanitizeUrlPath(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value, `https://${YOUZHAO_HOST}`).pathname;
  } catch {
    return undefined;
  }
}

function buildPageFetchHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const safeHeaders = stripSensitiveHeaders(headersToRecord(headers) ?? {});
  safeHeaders.accept ??= "application/json";
  return safeHeaders;
}

function stripSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !isSensitiveHeader(key)),
  );
}

function isSensitiveHeader(key: string): boolean {
  return ["authorization", "cookie", "set-cookie", "token", "x-api-key"].includes(key.toLowerCase());
}

function headerValue(headers: Record<string, string>, key: string): string | undefined {
  const found = Object.entries(headers).find(([headerKey]) => headerKey.toLowerCase() === key.toLowerCase());
  return found?.[1];
}

function withFinalStatus(
  diagnostics: YouzhaoSessionDiagnostics | null,
  finalStatus: YouzhaoSessionStatus,
): YouzhaoSessionDiagnostics | undefined {
  if (!diagnostics) {
    return undefined;
  }
  return {
    ...diagnostics,
    finalStatus,
  };
}

function diagnosticsForEnvironment(
  diagnostics: YouzhaoSessionDiagnostics | undefined,
): YouzhaoSessionDiagnostics | undefined {
  return process.env.NODE_ENV === "production" ? undefined : diagnostics;
}

function isClosedContextError(error: unknown): boolean {
  return error instanceof Error && /Target page, context or browser has been closed/i.test(error.message);
}

function isPageFetchUnavailableError(error: unknown): boolean {
  return error instanceof Error &&
    /Target page, context or browser has been closed|Execution context was destroyed|evaluate/i.test(error.message);
}

function mapClientStatusToSessionStatus(status: YouzhaoApiStatus): YouzhaoSessionStatus {
  if (status === "success") {
    return "authenticated";
  }
  if (
    status === "requires_login" ||
    status === "forbidden" ||
    status === "blocked" ||
    status === "timeout" ||
    status === "schema_changed"
  ) {
    return status;
  }
  return "failed";
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers;
}
