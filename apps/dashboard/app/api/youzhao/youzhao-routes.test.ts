import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as previewPost } from "./preview/route";
import { POST as probePost } from "./probe/route";

describe("youzhao API routes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects probe when city is missing", async () => {
    const response = await probePost(jsonRequest({}));
    const json = (await response.json()) as { status: string; error: string };

    expect(response.status).toBe(400);
    expect(json.status).toBe("failed");
    expect(json.error).toContain("必须选择一个城市");
  });

  it("returns requires_login instead of success for unauthenticated upstream responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 401)));

    const response = await probePost(jsonRequest({ city: "上海", limit: 20 }));
    const json = (await response.json()) as { status: string };

    expect(response.status).toBe(401);
    expect(json.status).toBe("requires_login");
  });

  it("builds public pipeline preview rows for recruiting youzhao jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          data: [
            {
              id: "job-a",
              station_id: "site-1",
              site_name: "Synthetic Site",
              site_address: "Synthetic Road",
              station_master_name: "Manager A",
              station_master_phone: ["199", "0000", "0000"].join(""),
              position_name: "Synthetic Job",
              salary_plan: "Synthetic salary",
              extra_policy: "Synthetic welfare",
              settlement_rule: "Synthetic settlement",
              business_line: "淘宝 UB",
              recruitment_status: "1",
            },
            {
              id: "job-b",
              station_id: "site-1",
              site_name: "Synthetic Site",
              recruitment_status: "0",
            },
          ],
          pagination: { total: 2 },
        }),
      ),
    );

    const response = await previewPost(jsonRequest({ city: "上海", limit: 20 }));
    const json = (await response.json()) as {
      status: string;
      filteredNonRecruiting: number;
      rows: Array<{ source: string; targetLayer?: string; mapped: { sourceId?: string } }>;
      summary: { valid: number };
    };

    expect(response.status).toBe(200);
    expect(json.status).toBe("success");
    expect(json.filteredNonRecruiting).toBe(1);
    expect(json.summary.valid).toBe(1);
    expect(json.rows[0]).toMatchObject({
      source: "youzhao",
      targetLayer: "淘宝点",
      mapped: {
        sourceId: "site-1:job-a",
      },
    });
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
