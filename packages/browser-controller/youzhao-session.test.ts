import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  YOUZHAO_LOGIN_URL,
  YOUZHAO_PROFILE_RELATIVE_DIR,
  checkYouzhaoLoginSession,
  fetchWithYouzhaoSession,
  openYouzhaoLoginSession,
  resetYouzhaoSessionForTests,
} from "./youzhao-session";

describe("youzhao persistent session", () => {
  beforeEach(() => {
    resetYouzhaoSessionForTests();
  });

  it("opens a headed persistent context in the ignored profile without claiming login", async () => {
    const page = {
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
    };
    const context = {
      pages: () => [page],
      newPage: vi.fn(),
      request: {
        get: vi.fn(),
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn(async () => context),
    };

    const result = await openYouzhaoLoginSession({ adapter });

    expect(result).toMatchObject({
      status: "opened",
      authenticated: false,
      profileDir: YOUZHAO_PROFILE_RELATIVE_DIR,
    });
    expect(adapter.launchPersistentContext).toHaveBeenCalledWith(
      expect.stringContaining(join("data", "browser-profile", "youzhao")),
      expect.objectContaining({ headless: false }),
    );
    expect(page.goto).toHaveBeenCalledWith(
      YOUZHAO_LOGIN_URL,
      expect.objectContaining({ waitUntil: "domcontentloaded" }),
    );

    const gitignore = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toContain("data/browser-profile/");
  });

  it("reuses an already open youzhao page instead of creating a new browser page", async () => {
    const youzhaoPage = {
      url: () => YOUZHAO_LOGIN_URL,
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
    };
    const blankPage = {
      url: () => "about:blank",
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
    };
    const context = {
      pages: () => [blankPage, youzhaoPage],
      newPage: vi.fn(),
      request: {
        get: vi.fn(),
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn(async () => context),
    };

    await openYouzhaoLoginSession({ adapter });
    await openYouzhaoLoginSession({ adapter });

    expect(adapter.launchPersistentContext).toHaveBeenCalledTimes(1);
    expect(context.newPage).not.toHaveBeenCalled();
    expect(youzhaoPage.bringToFront).toHaveBeenCalledTimes(2);
    expect(youzhaoPage.goto).not.toHaveBeenCalled();
  });

  it("relaunches the persistent context when the stored context was already closed", async () => {
    const closedContext = {
      pages: () => {
        throw new Error("Target page, context or browser has been closed");
      },
      newPage: vi.fn(),
      request: {
        get: vi.fn(),
      },
    };
    const freshPage = {
      url: () => "about:blank",
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
    };
    const freshContext = {
      pages: () => [freshPage],
      newPage: vi.fn(),
      request: {
        get: vi.fn(),
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn()
        .mockResolvedValueOnce(closedContext)
        .mockResolvedValueOnce(freshContext),
    };

    await openYouzhaoLoginSession({ adapter });
    const result = await openYouzhaoLoginSession({ adapter });

    expect(result.status).toBe("opened");
    expect(adapter.launchPersistentContext).toHaveBeenCalledTimes(2);
    expect(freshPage.goto).toHaveBeenCalledWith(YOUZHAO_LOGIN_URL, expect.any(Object));
  });

  it("checks login with fixed probe params instead of the user-selected city", async () => {
    const requestedUrls: string[] = [];
    const result = await checkYouzhaoLoginSession(
      { city: "\u676d\u5dde" },
      {
        fetchImpl: vi.fn(async (input: RequestInfo | URL) => {
          requestedUrls.push(String(input));
          return new Response(JSON.stringify({}), { status: 401 });
        }),
      },
    );

    expect(result.status).toBe("requires_login");
    const url = new URL(requestedUrls[0] ?? "");
    expect(url.hostname).toBe("hr.qingz.xyz");
    expect(url.pathname).toBe("/api/positions");
    expect(url.searchParams.get("city")).not.toBe("\u676d\u5dde");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("1");
    expect(url.searchParams.get("status")).toBe("1");
  });

  it("uses an existing youzhao page for same-origin fetch before context.request", async () => {
    const page = {
      url: () => YOUZHAO_LOGIN_URL,
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => ({
        status: 200,
        body: JSON.stringify({ data: [], pagination: { total: 0 } }),
        headers: { "content-type": "application/json" },
      })),
    };
    const contextRequestGet = vi.fn(async () => {
      throw new Error("context.request should not be used when a youzhao page exists");
    });
    const context = {
      pages: () => [page],
      newPage: vi.fn(),
      request: {
        get: contextRequestGet,
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn(async () => context),
    };

    await openYouzhaoLoginSession({ adapter });
    const response = await fetchWithYouzhaoSession(
      "https://hr.qingz.xyz/api/positions?page=1&pageSize=1&city=%E4%B8%8A%E6%B5%B7&status=1",
    );

    expect(response.status).toBe(200);
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), {
      headers: { accept: "application/json" },
      nativeAuthHeaderNames: [],
      path: "/api/positions?page=1&pageSize=1&city=%E4%B8%8A%E6%B5%B7&status=1",
    });
    expect(contextRequestGet).not.toHaveBeenCalled();
  });

  it("keeps storage token inside the page context while authenticating API requests", async () => {
    const syntheticSecret = "synthetic-secret-token";
    const handlers: Partial<Record<"request" | "response", (event: unknown) => void>> = {};
    const page = {
      url: () => YOUZHAO_LOGIN_URL,
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
      off: vi.fn((event: "request" | "response") => {
        delete handlers[event];
      }),
      on: vi.fn((event: "request" | "response", handler: (event: unknown) => void) => {
        handlers[event] = handler;
      }),
      reload: vi.fn(async () => {
        handlers.request?.({
          headers: () => ({ accept: "application/json", authorization: "redacted" }),
          method: () => "GET",
          url: () => "https://hr.qingz.xyz/api/positions?page=1&status=1",
        });
        handlers.response?.({
          status: () => 200,
          url: () => "https://hr.qingz.xyz/api/positions?page=1&status=1",
        });
      }),
      evaluate: vi.fn(async (_pageFunction, arg) => {
        expect(JSON.stringify(arg)).not.toContain(syntheticSecret);
        return {
          status: 200,
          body: JSON.stringify({ data: [], pagination: { total: 0 } }),
          headers: { "content-type": "application/json" },
          diagnostics: {
            businessPageVisible: true,
            pagePathname: "/push/records",
            bareFetchHttpStatus: 401,
            authenticatedFetchHttpStatus: 200,
            localStorageKeys: ["access_token"],
            sessionStorageKeys: [],
            authHeaderNames: ["authorization"],
            authStorageKeyUsed: "access_token",
            tokenStayedInPage: true,
          },
        };
      }),
    };
    const context = {
      pages: () => [page],
      newPage: vi.fn(),
      request: {
        get: vi.fn(),
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn(async () => context),
    };

    await openYouzhaoLoginSession({ adapter });
    const result = await checkYouzhaoLoginSession({}, { fetchImpl: fetchWithYouzhaoSession });

    expect(result.status).toBe("authenticated");
    expect(result.diagnostics).toMatchObject({
      requestMode: "page-auth-fetch",
      authHeaderNames: ["authorization"],
      authStorageKeyUsed: "access_token",
      tokenStayedInPage: true,
    });
    expect(JSON.stringify(result)).not.toContain(syntheticSecret);
    expect(context.request.get).not.toHaveBeenCalled();
  });

  it("reports auth_mechanism_unknown when the business page is visible but no auth header can be built", async () => {
    const page = {
      url: () => YOUZHAO_LOGIN_URL,
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
      evaluate: vi.fn(async () => ({
        status: 401,
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        diagnostics: {
          businessPageVisible: true,
          pagePathname: "/push/records",
          bareFetchHttpStatus: 401,
          localStorageKeys: [],
          sessionStorageKeys: [],
          tokenStayedInPage: true,
          finalAuthStatus: "auth_mechanism_unknown" as const,
        },
      })),
    };
    const context = {
      pages: () => [page],
      newPage: vi.fn(),
      request: {
        get: vi.fn(),
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn(async () => context),
    };

    await openYouzhaoLoginSession({ adapter });
    const result = await checkYouzhaoLoginSession({}, { fetchImpl: fetchWithYouzhaoSession });

    expect(result.status).toBe("auth_mechanism_unknown");
    expect(result.authenticated).toBe(false);
  });

  it("reports auth_failed when the page-built auth header still receives 401", async () => {
    const handlers: Partial<Record<"request" | "response", (event: unknown) => void>> = {};
    const page = {
      url: () => YOUZHAO_LOGIN_URL,
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
      off: vi.fn((event: "request" | "response") => {
        delete handlers[event];
      }),
      on: vi.fn((event: "request" | "response", handler: (event: unknown) => void) => {
        handlers[event] = handler;
      }),
      reload: vi.fn(async () => {
        handlers.request?.({
          headers: () => ({ accept: "application/json", authorization: "redacted" }),
          method: () => "GET",
          url: () => "https://hr.qingz.xyz/api/positions?page=1&status=1",
        });
        handlers.response?.({
          status: () => 401,
          url: () => "https://hr.qingz.xyz/api/positions?page=1&status=1",
        });
      }),
      evaluate: vi.fn(async () => ({
        status: 401,
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        diagnostics: {
          businessPageVisible: true,
          pagePathname: "/push/records",
          bareFetchHttpStatus: 401,
          authenticatedFetchHttpStatus: 401,
          localStorageKeys: ["access_token"],
          sessionStorageKeys: [],
          authHeaderNames: ["authorization"],
          authStorageKeyUsed: "access_token",
          tokenStayedInPage: true,
          finalAuthStatus: "auth_failed" as const,
        },
      })),
    };
    const context = {
      pages: () => [page],
      newPage: vi.fn(),
      request: {
        get: vi.fn(),
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn(async () => context),
    };

    await openYouzhaoLoginSession({ adapter });
    const result = await checkYouzhaoLoginSession({}, { fetchImpl: fetchWithYouzhaoSession });

    expect(result.status).toBe("auth_failed");
    expect(result.authenticated).toBe(false);
  });

  it("falls back to context.request only when page fetch is unavailable", async () => {
    const page = {
      url: () => YOUZHAO_LOGIN_URL,
      bringToFront: vi.fn(async () => undefined),
      goto: vi.fn(async () => undefined),
    };
    const context = {
      pages: () => [page],
      newPage: vi.fn(),
      request: {
        get: vi.fn(async () => ({
          status: () => 200,
          headers: () => ({ "content-type": "application/json" }),
          body: async () => Buffer.from(JSON.stringify({ data: [], pagination: { total: 0 } })),
        })),
      },
    };
    const adapter = {
      launchPersistentContext: vi.fn(async () => context),
    };

    await openYouzhaoLoginSession({ adapter });
    const response = await fetchWithYouzhaoSession("https://hr.qingz.xyz/api/positions?page=1");

    expect(response.status).toBe(200);
    expect(context.request.get).toHaveBeenCalledWith(
      "https://hr.qingz.xyz/api/positions?page=1",
      expect.objectContaining({ headers: undefined }),
    );
  });
});
