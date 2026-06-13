import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  YOUZHAO_LOGIN_URL,
  YOUZHAO_PROFILE_RELATIVE_DIR,
  checkYouzhaoLoginSession,
  resetYouzhaoSessionForTests,
  openYouzhaoLoginSession,
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
    expect(page.goto).toHaveBeenCalledWith(YOUZHAO_LOGIN_URL, expect.objectContaining({ waitUntil: "domcontentloaded" }));

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

  it("checks login through the authenticated context API instead of page URL", async () => {
    const requestedUrls: string[] = [];
    const result = await checkYouzhaoLoginSession(
      { city: "上海" },
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
    expect(url.searchParams.get("city")).toBe("上海");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("pageSize")).toBe("1");
    expect(url.searchParams.get("status")).toBe("1");
  });
});
