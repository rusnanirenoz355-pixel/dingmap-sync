import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkYouzhaoLoginSession,
  fetchWithYouzhaoSession,
  openYouzhaoLoginSession,
} from "@dingmap-sync/browser-controller/youzhao-session";
import {
  importYouzhaoPositions,
  previewYouzhaoPositionsForImport,
} from "@dingmap-sync/db/youzhao-import";
import { POST as importPost } from "./import/route";
import { POST as previewPost } from "./preview/route";
import { POST as probePost } from "./probe/route";
import { GET as sessionCheckGet } from "./session/check/route";
import { POST as sessionOpenPost } from "./session/open/route";

vi.mock("@dingmap-sync/browser-controller/youzhao-session", () => ({
  checkYouzhaoLoginSession: vi.fn(),
  fetchWithYouzhaoSession: vi.fn(),
  openYouzhaoLoginSession: vi.fn(),
}));

vi.mock("@dingmap-sync/db/youzhao-import", () => ({
  importYouzhaoPositions: vi.fn(),
  previewYouzhaoPositionsForImport: vi.fn(),
}));

const emptySummary = { valid: 0, invalid: 0, duplicate: 0, update_candidate: 0 };
const shanghai = "\u4e0a\u6d77";
const meituanLayer = "\u7f8e\u56e2\u70b9";

describe("youzhao API routes", () => {
  beforeEach(() => {
    vi.mocked(openYouzhaoLoginSession).mockReset();
    vi.mocked(checkYouzhaoLoginSession).mockReset();
    vi.mocked(fetchWithYouzhaoSession).mockReset();
    vi.mocked(previewYouzhaoPositionsForImport).mockReset();
    vi.mocked(importYouzhaoPositions).mockReset();
  });

  it("opens the manual login browser without claiming authentication", async () => {
    vi.mocked(openYouzhaoLoginSession).mockResolvedValue({
      status: "opened",
      authenticated: false,
      profileDir: "data/browser-profile/youzhao",
    });

    const response = await sessionOpenPost();
    const json = (await response.json()) as { status: string; authenticated: boolean };

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ status: "opened", authenticated: false });
  });

  it("checks login status without trusting the dashboard city field", async () => {
    vi.mocked(checkYouzhaoLoginSession).mockResolvedValue({
      status: "requires_login",
      authenticated: false,
      diagnostics: {
        sessionFound: true,
        contextClosed: false,
        pageCount: 1,
        youzhaoPageFound: true,
        youzhaoPageUrl: "/push/records",
        requestMode: "page-fetch",
        httpStatus: 401,
        contentType: "application/json",
        finalStatus: "requires_login",
      },
    });

    const response = await sessionCheckGet(
      new Request(`http://localhost/api/youzhao/session/check?city=${encodeURIComponent(shanghai)}`),
    );
    const json = (await response.json()) as { status: string; diagnostics?: { requestMode?: string } };

    expect(response.status).toBe(401);
    expect(json.status).toBe("requires_login");
    expect(json.diagnostics?.requestMode).toBe("page-fetch");
    expect(checkYouzhaoLoginSession).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ fetchImpl: fetchWithYouzhaoSession }),
    );
  });

  it("uses the authenticated session fetch for probe and preview", async () => {
    vi.mocked(fetchWithYouzhaoSession).mockResolvedValue(
      jsonResponse({
        data: [],
        pagination: { total: 0 },
      }),
    );
    vi.mocked(previewYouzhaoPositionsForImport).mockResolvedValue({
      status: "success",
      method: "GET",
      endpoint: "/api/positions",
      params: { city: shanghai, page: "1", pageSize: "20", status: "1" },
      total: 0,
      items: [],
      rawReturned: 0,
      filteredNonRecruiting: 0,
      rawRows: [],
      rows: [],
      summary: emptySummary,
      targetLayerCounts: {},
    });

    const probeResponse = await probePost(jsonRequest({ city: shanghai, limit: 20 }));
    const previewResponse = await previewPost(jsonRequest({ city: shanghai, limit: 20 }));

    expect(probeResponse.status).toBe(200);
    expect(previewResponse.status).toBe(200);
    expect(fetchWithYouzhaoSession).toHaveBeenCalled();
    expect(previewYouzhaoPositionsForImport).toHaveBeenCalledTimes(1);
    expect(previewYouzhaoPositionsForImport).toHaveBeenCalledWith(
      { city: shanghai, limit: 20 },
      expect.objectContaining({ fetchImpl: fetchWithYouzhaoSession }),
    );
  });

  it("imports by accepting collection params only and delegating server-side refetch", async () => {
    vi.mocked(importYouzhaoPositions).mockResolvedValue({
      status: "success",
      method: "GET",
      endpoint: "/api/positions",
      params: { city: shanghai, page: "1", pageSize: "20", status: "1" },
      total: 1,
      items: [],
      rawReturned: 1,
      filteredNonRecruiting: 0,
      rawRows: [],
      rows: [],
      summary: { valid: 1, invalid: 0, duplicate: 0, update_candidate: 0 },
      targetLayerCounts: { [meituanLayer]: 1 },
      inserted: 1,
      updated: 0,
      skippedDuplicate: 0,
      skippedInvalid: 0,
      skippedOther: 0,
      updateCandidate: 0,
      cleanMarkers: [],
    });

    const response = await importPost(jsonRequest({
      city: shanghai,
      page: 1,
      pageSize: 20,
      limit: 20,
      rows: [{ status: "valid", mergeKey: "forged", currentHash: "forged" }],
    }));
    const json = (await response.json()) as { inserted: number };

    expect(response.status).toBe(200);
    expect(json.inserted).toBe(1);
    expect(importYouzhaoPositions).toHaveBeenCalledWith(
      { city: shanghai, page: 1, pageSize: 20, limit: 20 },
      expect.objectContaining({ fetchImpl: fetchWithYouzhaoSession }),
    );
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/youzhao", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
