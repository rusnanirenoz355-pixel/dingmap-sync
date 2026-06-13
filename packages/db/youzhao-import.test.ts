import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importYouzhaoPositions, previewYouzhaoPositionsForImport } from "./youzhao-import";

const databasePath = join(process.cwd(), "data", "test-youzhao-import.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

describe("youzhao import database service", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new DatabaseSync(databasePath);
    database.exec(schemaSql);
    database.close();
  });

  it("previews by fetching from the authenticated server-side source", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [recruitingJob("job-a")], pagination: { total: 1 } }));

    const result = await previewYouzhaoPositionsForImport({ city: "上海", limit: 20 }, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
    expect(result.summary.valid).toBe(1);
    expect(result.rows[0]).toMatchObject({
      source: "youzhao",
      targetLayer: "美团点",
      mapped: {
        sourceId: "site-1:job-a",
        longitude: null,
        latitude: null,
      },
    });
  });

  it("imports by refetching and revalidating instead of trusting client preview rows", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          recruitingJob("job-a"),
          { ...recruitingJob("job-b"), recruitment_status: "0" },
        ],
        pagination: { total: 2 },
      }),
    );

    const result = await importYouzhaoPositions(
      {
        city: "上海",
        limit: 20,
        rows: [
          {
            status: "valid",
            mergeKey: "forged",
            currentHash: "forged",
          },
        ],
      } as Record<string, unknown>,
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("success");
    expect(result.filteredNonRecruiting).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.cleanMarkers[0]).toMatchObject({
      source: "youzhao",
      originType: "web",
      sourceId: "site-1:job-a",
      siteName: "Synthetic Site",
      jobTitle: "Synthetic Job",
      salary: "Synthetic salary",
      welfare: "Synthetic welfare",
      remark: "Synthetic settlement",
    });
  });
});

function recruitingJob(id: string) {
  return {
    id,
    station_id: "site-1",
    site_name: "Synthetic Site",
    site_address: "Synthetic Road",
    station_master_name: "Manager A",
    station_master_phone: syntheticPhone,
    position_name: "Synthetic Job",
    salary_plan: "Synthetic salary",
    extra_policy: "Synthetic welfare",
    settlement_rule: "Synthetic settlement",
    business_line: "美团",
    recruitment_status: "1",
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
