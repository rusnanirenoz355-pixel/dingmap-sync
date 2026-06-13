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
  | "auth_mechanism_unknown"
  | "auth_failed"
  | "failed";

export type YouzhaoRequestMode = "page-fetch" | "page-auth-fetch" | "context-request";

export type YouzhaoAuthProbeStatus =
  | "authenticated"
  | "requires_login"
  | "auth_mechanism_unknown"
  | "auth_failed";

interface YouzhaoPageFeatureFlags {
  positionManagementVisible: boolean;
  positionListVisible: boolean;
  businessTextVisible: boolean;
}

interface YouzhaoNativeRequestSummary {
  method: string;
  pathname: string;
  queryParamNames: string[];
  httpStatus?: number;
  requestHeaderNames: string[];
  authHeaderNames: string[];
  differentFromBareFetchHeaderNames: string[];
}

interface YouzhaoNativeRequestCapture {
  jobListNavigationCandidates: YouzhaoNavigationCandidate[];
  jobListNavigationAttempted: boolean;
  jobListNavigationClicked: boolean;
  pathnameAfterClick?: string;
  positionListVisibleAfterClick?: boolean;
  request?: YouzhaoNativeRequestSummary;
}

interface YouzhaoNavigationCandidate {
  hrefPath?: string;
  role?: string;
  tagName: string;
  text: string;
}

interface YouzhaoJobListOpenResult {
  candidates: YouzhaoNavigationCandidate[];
  clicked: boolean;
  pathnameAfterClick?: string;
  positionListVisibleAfterClick?: boolean;
}

export interface YouzhaoSessionDiagnostics {
  sessionFound: boolean;
  contextClosed: boolean;
  pageCount: number;
  youzhaoPageFound: boolean;
  youzhaoPageUrl?: string;
  pagePathname?: string;
  businessPageVisible?: boolean;
  pageRefreshPreservedLogin?: boolean;
  businessFeatureFlags?: YouzhaoPageFeatureFlags;
  requestMode?: YouzhaoRequestMode;
  httpStatus?: number;
  contentType?: string;
  responseUrl?: string;
  bareFetchHttpStatus?: number;
  authenticatedFetchHttpStatus?: number;
  localStorageKeys?: string[];
  sessionStorageKeys?: string[];
  sensitiveStorageKeyHints?: string[];
  nativePositionsRequest?: YouzhaoNativeRequestSummary;
  jobListNavigationCandidates?: YouzhaoNavigationCandidate[];
  jobListNavigationAttempted?: boolean;
  jobListNavigationClicked?: boolean;
  jobListPathnameAfterClick?: string;
  jobListPositionListVisibleAfterClick?: boolean;
  authHeaderNames?: string[];
  authStorageKeyUsed?: string;
  tokenStayedInPage?: boolean;
  finalAuthStatus?: YouzhaoAuthProbeStatus;
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
  diagnostics?: Partial<YouzhaoSessionDiagnostics>;
}

type YouzhaoPageEvaluateArg =
  | {
    path: string;
    headers: Record<string, string>;
    nativeAuthHeaderNames: string[];
  }
  | { action: "open-job-list" };

type YouzhaoPageEvaluateResult = PageFetchResult | boolean | YouzhaoJobListOpenResult;

export interface YouzhaoPersistentPage {
  bringToFront?: () => Promise<void>;
  evaluate?: (
    pageFunction: (arg: YouzhaoPageEvaluateArg) => YouzhaoPageEvaluateResult | Promise<YouzhaoPageEvaluateResult>,
    arg: YouzhaoPageEvaluateArg,
  ) => Promise<YouzhaoPageEvaluateResult>;
  goto: (url: string, options?: { waitUntil?: "domcontentloaded"; timeout?: number }) => Promise<unknown>;
  off?: (event: "request" | "response", handler: (event: unknown) => void) => void;
  on?: (event: "request" | "response", handler: (event: unknown) => void) => void;
  reload?: (options?: { waitUntil?: "domcontentloaded"; timeout?: number }) => Promise<unknown>;
  url?: () => string;
}

export interface YouzhaoPersistentContext {
  pages: () => YouzhaoPersistentPage[];
  newPage: () => Promise<YouzhaoPersistentPage>;
  request: ContextRequest;
}

export interface YouzhaoLaunchOptions {
  args?: string[];
  headless: boolean;
  viewport?: null;
}

export interface YouzhaoSessionAdapter {
  launchPersistentContext: (
    profileDir: string,
    options: YouzhaoLaunchOptions,
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
      const nativePositionsCapture = await captureNativePositionsRequestSummary(youzhaoPage, DEFAULT_TIMEOUT_MS);
      const pageResponse = await requestFromYouzhaoPage(
        youzhaoPage,
        input,
        buildPageFetchHeaders(init.headers),
        nativePositionsCapture.request?.authHeaderNames ?? [],
        DEFAULT_TIMEOUT_MS,
      );
      const authStatus = pageResponse.diagnostics?.finalAuthStatus;
      const requestMode: YouzhaoRequestMode = pageResponse.diagnostics?.authenticatedFetchHttpStatus
        ? "page-auth-fetch"
        : "page-fetch";
      const diagnostics: YouzhaoSessionDiagnostics = {
        ...initialDiagnostics,
        ...pageResponse.diagnostics,
        requestMode,
        httpStatus: pageResponse.status,
        contentType: headerValue(pageResponse.headers, "content-type"),
        responseUrl: sanitizeUrlPath(pageResponse.url),
        nativePositionsRequest: nativePositionsCapture.request,
        jobListNavigationCandidates: sanitizeNavigationCandidates(nativePositionsCapture.jobListNavigationCandidates),
        jobListNavigationAttempted: nativePositionsCapture.jobListNavigationAttempted,
        jobListNavigationClicked: nativePositionsCapture.jobListNavigationClicked,
        jobListPathnameAfterClick: nativePositionsCapture.pathnameAfterClick,
        jobListPositionListVisibleAfterClick: nativePositionsCapture.positionListVisibleAfterClick,
      };
      store.lastDiagnostics = diagnostics;
      const responseHeaders = new Headers(pageResponse.headers);
      responseHeaders.set("x-dingmap-youzhao-request-mode", requestMode);
      if (authStatus) {
        responseHeaders.set("x-dingmap-youzhao-auth-status", authStatus);
      }
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
  store.activeContext ??= await adapter.launchPersistentContext(profileDir, {
    args: ["--start-maximized"],
    headless: false,
    viewport: null,
  });
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
  nativeAuthHeaderNames: string[],
  timeoutMs: number,
): Promise<PageFetchResult> {
  const path = toYouzhaoRelativePath(input);
  const result = await withRequestTimeout(
    page.evaluate!(
      async (arg) => {
        if ("action" in arg) {
          return false;
        }
        const {
          path: requestPath,
          headers: requestHeaders,
          nativeAuthHeaderNames: nativeHeaders,
        } = arg;
        const text = document.body?.innerText ?? "";
        const pagePathname = window.location.pathname;
        const businessFeatureFlags = {
          positionManagementVisible: text.includes("\u5c97\u4f4d\u7ba1\u7406"),
          positionListVisible: text.includes("\u5c97\u4f4d\u5217\u8868"),
          businessTextVisible: /\u5c97\u4f4d|\u62db\u8058|\u7ad9\u70b9/.test(text),
        };
        const businessPageVisible = !/login|signin/i.test(pagePathname) &&
          Object.values(businessFeatureFlags).some(Boolean);
        const localStorageKeys = Object.keys(localStorage);
        const sessionStorageKeys = Object.keys(sessionStorage);
        const sensitiveStorageKeyHints = [...localStorageKeys, ...sessionStorageKeys]
          .filter((key) => /token|authorization|jwt|session/i.test(key))
          .sort();

        const bareResponse = await fetch(requestPath, {
          method: "GET",
          credentials: "include",
          headers: requestHeaders,
        });
        const bareBody = await bareResponse.text();
        const baseDiagnostics = {
          pagePathname,
          businessPageVisible,
          pageRefreshPreservedLogin: businessPageVisible,
          businessFeatureFlags,
          bareFetchHttpStatus: bareResponse.status,
          localStorageKeys,
          sessionStorageKeys,
          sensitiveStorageKeyHints,
          tokenStayedInPage: true,
        };

        if (bareResponse.status !== 401 || !businessPageVisible) {
          return {
            status: bareResponse.status,
            headers: Object.fromEntries(bareResponse.headers.entries()),
            body: bareBody,
            url: bareResponse.url,
            diagnostics: {
              ...baseDiagnostics,
              finalAuthStatus: bareResponse.status === 401 ? "requires_login" : undefined,
            },
          };
        }

        const storageCandidates = [
          ...localStorageKeys.map((key) => ({ area: "local" as const, key })),
          ...sessionStorageKeys.map((key) => ({ area: "session" as const, key })),
        ].filter(({ key }) => /token|authorization|jwt|session/i.test(key));
        const tokenEntry = storageCandidates.find(({ area, key }) => {
          const value = area === "local" ? localStorage.getItem(key) : sessionStorage.getItem(key);
          return Boolean(value);
        });
        const authHeaderName = nativeHeaders.find((header) => /authorization|token/i.test(header)) ?? "";

        if (!tokenEntry || !authHeaderName) {
          return {
            status: bareResponse.status,
            headers: Object.fromEntries(bareResponse.headers.entries()),
            body: bareBody,
            url: bareResponse.url,
            diagnostics: {
              ...baseDiagnostics,
              finalAuthStatus: "auth_mechanism_unknown",
            },
          };
        }

        const tokenValue = tokenEntry.area === "local"
          ? localStorage.getItem(tokenEntry.key)
          : sessionStorage.getItem(tokenEntry.key);
        const authHeaders = { ...requestHeaders };
        if (authHeaderName.toLowerCase() === "authorization") {
          authHeaders[authHeaderName] = tokenValue?.match(/^Bearer\s+/i) ? tokenValue : `Bearer ${tokenValue}`;
        } else {
          authHeaders[authHeaderName] = tokenValue ?? "";
        }

        const authedResponse = await fetch(requestPath, {
          method: "GET",
          credentials: "include",
          headers: authHeaders,
        });
        const authedBody = await authedResponse.text();
        return {
          status: authedResponse.status,
          headers: Object.fromEntries(authedResponse.headers.entries()),
          body: authedBody,
          url: authedResponse.url,
          diagnostics: {
            ...baseDiagnostics,
            authenticatedFetchHttpStatus: authedResponse.status,
            authHeaderNames: [authHeaderName.toLowerCase()],
            authStorageKeyUsed: tokenEntry.key,
            finalAuthStatus: authedResponse.status === 401
              ? "auth_failed"
              : authedResponse.status === 403
                ? "auth_failed"
                : authedResponse.ok
                  ? "authenticated"
                  : undefined,
          },
        };
      },
      { path, headers, nativeAuthHeaderNames },
    ),
    timeoutMs,
  );
  return result as PageFetchResult;
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

async function captureNativePositionsRequestSummary(
  page: YouzhaoPersistentPage,
  timeoutMs: number,
): Promise<YouzhaoNativeRequestCapture> {
  if (!page.on || !page.off) {
    return {
      jobListNavigationCandidates: [],
      jobListNavigationAttempted: false,
      jobListNavigationClicked: false,
    };
  }

  let requestSummary: YouzhaoNativeRequestSummary | undefined;
  let jobListOpenResult: YouzhaoJobListOpenResult = {
    candidates: [],
    clicked: false,
  };
  let jobListNavigationAttempted = false;
  const onRequest = (event: unknown) => {
    const url = callStringMethod(event, "url");
    if (!url || !isPositionsUrl(url)) {
      return;
    }
    const parsedUrl = new URL(url);
    const requestHeaderNames = Object.keys(callRecordMethod(event, "headers")).map((header) => header.toLowerCase()).sort();
    requestSummary = {
      method: callStringMethod(event, "method") || "GET",
      pathname: parsedUrl.pathname,
      queryParamNames: Array.from(parsedUrl.searchParams.keys()).sort(),
      requestHeaderNames,
      authHeaderNames: requestHeaderNames.filter(isAuthRelatedHeader),
      differentFromBareFetchHeaderNames: requestHeaderNames
        .filter((header) => !["accept", "accept-language", "referer", "user-agent"].includes(header))
        .sort(),
    };
  };
  const onResponse = (event: unknown) => {
    const url = callStringMethod(event, "url");
    if (!url || !isPositionsUrl(url) || !requestSummary) {
      return;
    }
    requestSummary.httpStatus = callNumberMethod(event, "status");
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  try {
    await page.reload?.({ waitUntil: "domcontentloaded", timeout: Math.min(timeoutMs, 5_000) });
    await new Promise((resolve) => setTimeout(resolve, 800));
    if (!requestSummary) {
      jobListNavigationAttempted = true;
      jobListOpenResult = await openYouzhaoJobList(page, timeoutMs);
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    return {
      jobListNavigationCandidates: jobListOpenResult.candidates,
      jobListNavigationAttempted,
      jobListNavigationClicked: jobListOpenResult.clicked,
      pathnameAfterClick: jobListOpenResult.pathnameAfterClick,
      positionListVisibleAfterClick: jobListOpenResult.positionListVisibleAfterClick,
      request: requestSummary,
    };
  } finally {
    page.off("request", onRequest);
    page.off("response", onResponse);
  }
}

async function openYouzhaoJobList(
  page: YouzhaoPersistentPage,
  timeoutMs: number,
): Promise<YouzhaoJobListOpenResult> {
  if (!page.evaluate) {
    return {
      candidates: [],
      clicked: false,
    };
  }
  try {
    const result = await withRequestTimeout(
      page.evaluate(
        async (arg) => {
          if (!("action" in arg) || arg.action !== "open-job-list") {
            return {
              candidates: [],
              clicked: false,
            };
          }

          const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
          const isVisible = (element: Element): boolean => {
            const rect = (element as HTMLElement).getBoundingClientRect?.();
            return Boolean(rect && rect.width > 0 && rect.height > 0);
          };
          const sanitizeHrefPath = (href: string | null): string | undefined => {
            if (!href) {
              return undefined;
            }
            try {
              return new URL(href, window.location.origin).pathname;
            } catch {
              return undefined;
            }
          };
          const compactText = (value: string | null | undefined): string => {
            return (value ?? "").replace(/\s+/g, "").slice(0, 40);
          };
          const safeCandidateText = (element: Element, hrefPath?: string): string => {
            const haystack = [
              compactText(element.textContent),
              compactText(element.getAttribute("aria-label")),
              compactText(element.getAttribute("title")),
              hrefPath ?? "",
            ].join(" ");
            if (haystack.includes("岗位列表")) {
              return "岗位列表";
            }
            if (haystack.includes("岗位管理")) {
              return "岗位管理";
            }
            if (haystack.includes("职位列表")) {
              return "职位列表";
            }
            if (haystack.includes("职位管理")) {
              return "职位管理";
            }
            if (/positions?/i.test(haystack)) {
              return "positions-route";
            }
            if (/jobs?/i.test(haystack)) {
              return "jobs-route";
            }
            return "";
          };
          const summarizeCandidate = (element: Element): {
            hrefPath?: string;
            role?: string;
            tagName: string;
            text: string;
          } => {
            const actionable = getActionableElement(element) ?? element as HTMLElement;
            const hrefPath = sanitizeHrefPath(actionable.getAttribute("href"));
            return {
              hrefPath,
              role: actionable.getAttribute("role") ?? undefined,
              tagName: actionable.tagName.toLowerCase(),
              text: safeCandidateText(element, hrefPath),
            };
          };
          const getActionableElement = (element: Element): HTMLElement | null => {
            return element.closest(
              "a,button,[role='button'],[role='menuitem'],li,.ant-menu-item,.ant-menu-submenu-title",
            ) as HTMLElement | null;
          };
          const menuCandidates = (): Element[] => {
            return Array.from(document.querySelectorAll("button,a,li,span,div,[role='menuitem']"))
              .filter((element) => {
                if (!isVisible(element)) {
                  return false;
                }
                const text = compactText(element.textContent);
                const ariaLabel = compactText(element.getAttribute("aria-label"));
                const title = compactText(element.getAttribute("title"));
                const hrefPath = sanitizeHrefPath((element as HTMLElement).getAttribute("href")) ?? "";
                return Boolean(safeCandidateText(element, hrefPath)) &&
                  (text.length <= 24 || Boolean(hrefPath) || ["li", "a", "button"].includes(element.tagName.toLowerCase())) &&
                  /岗位管理|岗位列表|职位管理|职位列表|position|positions|job|jobs/i.test(`${text} ${ariaLabel} ${title} ${hrefPath}`);
              });
          };
          const clickByText = async (label: string): Promise<boolean> => {
            const compactLabel = label.replace(/\s+/g, "");
            const candidates = Array.from(document.querySelectorAll("button,a,li,span,div,[role='menuitem']"))
              .filter((element) => {
                if (!isVisible(element)) {
                  return false;
                }
                const text = compactText(element.textContent);
                const ariaLabel = compactText(element.getAttribute("aria-label"));
                const title = compactText(element.getAttribute("title"));
                return text.includes(compactLabel) || ariaLabel.includes(compactLabel) || title.includes(compactLabel);
              })
              .sort((left, right) => {
                const leftText = compactText(left.textContent);
                const rightText = compactText(right.textContent);
                const leftExact = leftText === compactLabel ? 0 : 1;
                const rightExact = rightText === compactLabel ? 0 : 1;
                if (leftExact !== rightExact) {
                  return leftExact - rightExact;
                }
                const scoreActionable = (element: Element): number => {
                  const target = getActionableElement(element) ?? element as HTMLElement;
                  const tagName = target.tagName.toLowerCase();
                  const role = target.getAttribute("role") ?? "";
                  if (role === "menuitem" || target.classList.contains("ant-menu-submenu-title")) {
                    return 0;
                  }
                  if (tagName === "li" || target.classList.contains("ant-menu-item")) {
                    return 1;
                  }
                  if (tagName === "a" || tagName === "button") {
                    return 2;
                  }
                  return 3;
                };
                const leftScore = scoreActionable(left);
                const rightScore = scoreActionable(right);
                if (leftScore !== rightScore) {
                  return leftScore - rightScore;
                }
                return leftText.length - rightText.length;
              });
            const clickedTargets = new Set<string>();
            for (const matched of candidates) {
              const text = compactText(matched.textContent);
              const ariaLabel = compactText(matched.getAttribute("aria-label"));
              const title = compactText(matched.getAttribute("title"));
              if (!text.includes(compactLabel) && !ariaLabel.includes(compactLabel) && !title.includes(compactLabel)) {
                continue;
              }
              const target = getActionableElement(matched) ?? matched as HTMLElement;
              const rect = target.getBoundingClientRect();
              const targetKey = `${target.tagName}:${target.getAttribute("role") ?? ""}:${rect.left}:${rect.top}:${compactText(target.textContent)}`;
              if (clickedTargets.has(targetKey)) {
                continue;
              }
              clickedTargets.add(targetKey);
              target.scrollIntoView?.({ block: "center", inline: "nearest" });
              target.click();
              await sleep(700);
              if (label !== "岗位管理" || (document.body?.innerText ?? "").includes("岗位列表")) {
                return true;
              }
            }
            return clickedTargets.size > 0;
          };
          const clickByHrefHint = async (): Promise<boolean> => {
            const candidates = menuCandidates()
              .map((element) => ({ element, summary: summarizeCandidate(element) }))
              .filter(({ summary }) => /position|positions|job|jobs|岗位|职位/i.test(`${summary.hrefPath ?? ""} ${summary.text}`))
              .sort((left, right) => {
                const leftHasList = /list|列表/i.test(`${left.summary.hrefPath ?? ""} ${left.summary.text}`) ? 0 : 1;
                const rightHasList = /list|列表/i.test(`${right.summary.hrefPath ?? ""} ${right.summary.text}`) ? 0 : 1;
                return leftHasList - rightHasList;
              });
            const target = candidates
              .map(({ element }) => getActionableElement(element) ?? element as HTMLElement)
              .find((element) => isVisible(element));
            target?.scrollIntoView?.({ block: "center", inline: "nearest" });
            target?.click();
            if (target) {
              await sleep(900);
            }
            return Boolean(target);
          };

          const managementClicked = await clickByText("岗位管理");
          const listClicked = await clickByText("岗位列表");
          const hrefClicked = listClicked ? false : await clickByHrefHint();
          const textAfterClick = document.body?.innerText ?? "";
          return {
            candidates: menuCandidates().map(summarizeCandidate).slice(0, 20),
            clicked: managementClicked || listClicked || hrefClicked,
            pathnameAfterClick: window.location.pathname,
            positionListVisibleAfterClick: textAfterClick.includes("岗位列表"),
          };
        },
        { action: "open-job-list" },
      ),
      Math.min(timeoutMs, 4_000),
    );
    if (typeof result === "boolean") {
      return {
        candidates: [],
        clicked: result,
      };
    }
    return result as YouzhaoJobListOpenResult;
  } catch {
    return {
      candidates: [],
      clicked: false,
    };
  }
}

function isPositionsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === YOUZHAO_HOST && url.pathname === "/api/positions";
  } catch {
    return false;
  }
}

function sanitizeNavigationCandidates(candidates: YouzhaoNavigationCandidate[]): YouzhaoNavigationCandidate[] {
  const sanitized: YouzhaoNavigationCandidate[] = [];
  for (const candidate of candidates) {
    const text = safeNavigationText(candidate.text, candidate.hrefPath);
    if (!text) {
      continue;
    }
    sanitized.push({
      hrefPath: candidate.hrefPath,
      role: candidate.role,
      tagName: candidate.tagName,
      text,
    });
  }
  return sanitized;
}

function safeNavigationText(text: string, hrefPath: string | undefined): string {
  const haystack = `${text} ${hrefPath ?? ""}`;
  if (haystack.includes("岗位列表")) {
    return "岗位列表";
  }
  if (haystack.includes("岗位管理")) {
    return "岗位管理";
  }
  if (haystack.includes("职位列表")) {
    return "职位列表";
  }
  if (haystack.includes("职位管理")) {
    return "职位管理";
  }
  if (/positions?/i.test(haystack)) {
    return "positions-route";
  }
  if (/jobs?/i.test(haystack)) {
    return "jobs-route";
  }
  return "";
}

function callStringMethod(target: unknown, method: string): string {
  if (!target || typeof target !== "object" || !(method in target)) {
    return "";
  }
  const value = (target as Record<string, unknown>)[method];
  return typeof value === "function" ? String(value.call(target)) : "";
}

function callNumberMethod(target: unknown, method: string): number | undefined {
  if (!target || typeof target !== "object" || !(method in target)) {
    return undefined;
  }
  const value = (target as Record<string, unknown>)[method];
  if (typeof value !== "function") {
    return undefined;
  }
  const result = value.call(target);
  return typeof result === "number" ? result : undefined;
}

function callRecordMethod(target: unknown, method: string): Record<string, string> {
  if (!target || typeof target !== "object" || !(method in target)) {
    return {};
  }
  const value = (target as Record<string, unknown>)[method];
  if (typeof value !== "function") {
    return {};
  }
  const result = value.call(target);
  return typeof result === "object" && result !== null && !Array.isArray(result)
    ? result as Record<string, string>
    : {};
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

function isAuthRelatedHeader(key: string): boolean {
  return /authorization|token|cookie|session|jwt/i.test(key);
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
    status === "schema_changed" ||
    status === "auth_mechanism_unknown" ||
    status === "auth_failed"
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
