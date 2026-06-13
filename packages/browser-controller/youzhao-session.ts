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

export type YouzhaoSessionStatus =
  | "opened"
  | "authenticated"
  | "requires_login"
  | "forbidden"
  | "blocked"
  | "timeout"
  | "schema_changed"
  | "failed";

export interface YouzhaoSessionResult {
  status: YouzhaoSessionStatus;
  authenticated: boolean;
  pageDetected?: boolean;
  profileDir?: string;
  message?: string;
}

interface ContextRequest {
  get(url: string, options?: { headers?: Record<string, string>; timeout?: number }): Promise<{
    status(): number;
    headers(): Record<string, string>;
    body(): Promise<Buffer>;
  }>;
}

export interface YouzhaoPersistentPage {
  bringToFront?: () => Promise<void>;
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
  if (!store.activeContext) {
    store.activeContext = await adapter.launchPersistentContext(profileDir, { headless: false });
  }

  const page = await resolveYouzhaoLoginPage(store.activeContext);
  await page.bringToFront?.();
  const pageDetected = isYouzhaoPage(page);
  if (!pageDetected) {
    await page.goto(YOUZHAO_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });
  }

  return {
    status: "opened",
    authenticated: false,
    pageDetected: pageDetected || isYouzhaoPage(page),
    profileDir: YOUZHAO_PROFILE_RELATIVE_DIR,
  };
}

export async function checkYouzhaoLoginSession(
  input: YouzhaoQueryInput,
  options: YouzhaoSessionOptions = {},
): Promise<YouzhaoSessionResult> {
  const fetchImpl = options.fetchImpl ?? fetchWithYouzhaoSession;
  const result = await checkYouzhaoPositionsAccess(input, {
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });

  if (result.status === "success") {
    return {
      status: "authenticated",
      authenticated: true,
      pageDetected: hasYouzhaoPage(getSessionStore().activeContext),
    };
  }

  return {
    status: mapClientStatusToSessionStatus(result.status),
    authenticated: false,
    pageDetected: hasYouzhaoPage(getSessionStore().activeContext),
    message: result.message,
  };
}

export async function fetchWithYouzhaoSession(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const activeContext = getSessionStore().activeContext;
  if (!activeContext) {
    throw new Error("请先打开优招登录窗口并完成手动登录。");
  }
  if (init.method && init.method.toUpperCase() !== "GET") {
    throw new Error("优招认证请求第一版仅允许 GET。");
  }

  const apiResponse = await activeContext.request.get(String(input), {
    headers: headersToRecord(init.headers),
    timeout: DEFAULT_TIMEOUT_MS,
  });

  const body = await apiResponse.body();
  return new Response(new Uint8Array(body), {
    status: apiResponse.status(),
    headers: apiResponse.headers(),
  });
}

export function resetYouzhaoSessionForTests(): void {
  getSessionStore().activeContext = null;
}

function getSessionStore(): YouzhaoSessionStore {
  globalThis.__dingmapYouzhaoSession ??= { activeContext: null };
  return globalThis.__dingmapYouzhaoSession;
}

async function resolveYouzhaoLoginPage(
  context: YouzhaoPersistentContext,
): Promise<YouzhaoPersistentPage> {
  return findYouzhaoPage(context.pages()) ?? context.pages()[0] ?? context.newPage();
}

function findYouzhaoPage(pages: YouzhaoPersistentPage[]): YouzhaoPersistentPage | null {
  return pages.find(isYouzhaoPage) ?? null;
}

function hasYouzhaoPage(context: YouzhaoPersistentContext | null): boolean {
  return Boolean(context && findYouzhaoPage(context.pages()));
}

function isYouzhaoPage(page: YouzhaoPersistentPage): boolean {
  const url = page.url?.() ?? "";
  return url.startsWith("https://hr.qingz.xyz/");
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
