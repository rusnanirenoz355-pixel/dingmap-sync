import { describe, expect, it, vi } from "vitest";
import {
  YOUZHAO_POSITIONS_ENDPOINT,
  fetchYouzhaoRecruitingJobs,
  normalizeYouzhaoQuery,
  probeYouzhaoPositions,
} from "./client";

describe("youzhao API client", () => {
  it("validates city, single-city, limit, page, and pageSize boundaries", () => {
    expect(() => normalizeYouzhaoQuery({ city: "" })).toThrow("必须选择一个城市");
    expect(() => normalizeYouzhaoQuery({ city: ["上海", "杭州"] })).toThrow("一次只能指定一个城市");
    expect(() => normalizeYouzhaoQuery({ city: "上海,杭州" })).toThrow("一次只能指定一个城市");
    expect(() => normalizeYouzhaoQuery({ city: "上海", limit: 19 })).toThrow("limit 必须在 20 到 100 之间");
    expect(() => normalizeYouzhaoQuery({ city: "上海", limit: 101 })).toThrow("limit 必须在 20 到 100 之间");
    expect(() => normalizeYouzhaoQuery({ city: "上海", page: 0 })).toThrow("page 必须大于等于 1");
    expect(() => normalizeYouzhaoQuery({ city: "上海", pageSize: 0 })).toThrow("pageSize 必须在 1 到 50 之间");
    expect(() => normalizeYouzhaoQuery({ city: "上海", pageSize: 51 })).toThrow("pageSize 必须在 1 到 50 之间");

    expect(normalizeYouzhaoQuery({ city: " 上海 ", limit: 20 })).toMatchObject({
      city: "上海",
      page: 1,
      pageSize: 20,
      limit: 20,
      recruitmentStatus: "招聘中",
    });
    expect(normalizeYouzhaoQuery({ city: "上海", limit: 100 }).limit).toBe(100);
  });

  it("requests the positions list with city and recruiting status parameters", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      return jsonResponse({
        data: [
          {
            id: "job-a",
            station_id: "site-1",
            site_name: "Synthetic Site",
            site_address: "Synthetic Road",
            recruitment_status: "1",
          },
        ],
        pagination: { total: 1 },
      });
    });

    const result = await fetchYouzhaoRecruitingJobs(
      { city: "上海", page: 2, pageSize: 20, limit: 20 },
      { fetchImpl },
    );

    expect(result.status).toBe("success");
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    const url = new URL(requestedUrls[0] ?? "");
    expect(url.pathname).toBe(YOUZHAO_POSITIONS_ENDPOINT);
    expect(url.searchParams.get("city")).toBe("上海");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("20");
    expect(url.searchParams.get("status")).toBe("1");
  });

  it("maps 401, 403, timeout, and bad schemas to explicit statuses", async () => {
    await expectStatus(jsonResponse({}, 401), "requires_login");
    await expectStatus(jsonResponse({}, 403), "forbidden");
    await expectStatus(jsonResponse({}, 400), "failed");
    await expectStatus(htmlResponse("<html><form><input type=\"password\" /></form></html>"), "requires_login");
    await expectStatus(jsonResponse({ unexpected: true }, 200), "schema_changed");

    const timeoutFetch = vi.fn(
      () => new Promise<Response>((_, reject) => setTimeout(() => reject(new DOMException("Timeout", "AbortError")), 5)),
    );
    const timeout = await fetchYouzhaoRecruitingJobs(
      { city: "上海", limit: 20 },
      { fetchImpl: timeoutFetch, timeoutMs: 1 },
    );
    expect(timeout.status).toBe("timeout");
  });

  it("probe returns field names and counts without requiring real response values in reports", async () => {
    const result = await probeYouzhaoPositions(
      { city: "上海", limit: 20 },
      {
        fetchImpl: vi.fn(async () => jsonResponse({
          data: [
            {
              id: "job-a",
              station_id: "site-1",
              site_name: "Synthetic Site",
              site_address: "Synthetic Road",
              recruitment_status: "1",
            },
          ],
          pagination: { total: 1 },
        })),
      },
    );

    expect(result).toMatchObject({
      status: "success",
      method: "GET",
      endpoint: YOUZHAO_POSITIONS_ENDPOINT,
      returned: 1,
      total: 1,
      filteredNonRecruiting: 0,
    });
    expect(result.sampleFields).toEqual(
      expect.arrayContaining(["id", "station_id", "site_name", "site_address", "recruitment_status"]),
    );
  });
});

async function expectStatus(response: Response, status: string): Promise<void> {
  const result = await fetchYouzhaoRecruitingJobs(
    { city: "上海", limit: 20 },
    { fetchImpl: vi.fn(async () => response) },
  );
  expect(result.status).toBe(status);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html" },
  });
}
