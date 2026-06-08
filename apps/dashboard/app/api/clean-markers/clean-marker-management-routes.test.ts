import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, PATCH } from "./[id]/route";
import { GET } from "./manage/route";
import { GET as getCleanMarkers } from "./route";

const databasePath = join(process.cwd(), "data", "test-clean-marker-management-routes.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

function seedRouteMarker(): number {
  const database = new DatabaseSync(databasePath);
  const result = database
    .prepare(
      `
        INSERT INTO clean_markers (
          source, source_id, site_name, address, longitude, latitude, phone,
          origin_type, sync_action, sync_status, current_hash, merge_key
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      "manual_paste",
      "route-row",
      "Route Site",
      "Route Road",
      120,
      30,
      syntheticPhone,
      "manual_paste",
      "create",
      "pending",
      "before-hash",
      "site_address:route-site:route-road",
    );
  database.close();
  return Number(result.lastInsertRowid);
}

describe("clean marker management API routes", () => {
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

  it("lists managed rows with pagination, statistics, and sources", async () => {
    seedRouteMarker();
    const response = await GET(
      new Request("http://localhost/api/clean-markers/manage?page=1&pageSize=10"),
    );
    const json = (await response.json()) as {
      rows: Array<{ siteName: string; rawJson?: unknown }>;
      pagination: { total: number };
      statistics: { activeCount: number };
      sources: string[];
    };

    expect(response.status).toBe(200);
    expect(json.rows[0]?.siteName).toBe("Route Site");
    expect(json.rows[0]?.rawJson).toBeUndefined();
    expect(json.pagination.total).toBe(1);
    expect(json.statistics.activeCount).toBe(1);
    expect(json.sources).toContain("manual_paste");
  });

  it("patches editable fields and ignores trusted client fields", async () => {
    const id = seedRouteMarker();
    const response = await PATCH(
      new Request(`http://localhost/api/clean-markers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: "Route Updated",
          address: "Route Updated Road",
          source: "excel",
          syncStatus: "synced",
        }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );
    const json = (await response.json()) as {
      marker: { source: string; syncStatus: string; siteName: string };
    };

    expect(response.status).toBe(200);
    expect(json.marker.siteName).toBe("Route Updated");
    expect(json.marker.source).toBe("manual_paste");
    expect(json.marker.syncStatus).toBe("pending");
  });

  it("rejects invalid coordinates", async () => {
    const id = seedRouteMarker();
    const response = await PATCH(
      new Request(`http://localhost/api/clean-markers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longitude: 181 }),
      }),
      { params: Promise.resolve({ id: String(id) }) },
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid ids", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/clean-markers/not-a-number", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteName: "Route Updated" }),
      }),
      { params: Promise.resolve({ id: "not-a-number" }) },
    );

    expect(response.status).toBe(400);
  });

  it("returns not found for missing rows", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/clean-markers/999", { method: "DELETE" }),
      {
        params: Promise.resolve({ id: "999" }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("soft deletes rows idempotently and default Clean Table excludes them", async () => {
    const id = seedRouteMarker();
    const first = await DELETE(
      new Request(`http://localhost/api/clean-markers/${id}`, { method: "DELETE" }),
      {
        params: Promise.resolve({ id: String(id) }),
      },
    );
    const second = await DELETE(
      new Request(`http://localhost/api/clean-markers/${id}`, { method: "DELETE" }),
      {
        params: Promise.resolve({ id: String(id) }),
      },
    );
    const cleanResponse = await getCleanMarkers();
    const cleanJson = (await cleanResponse.json()) as { cleanMarkers: unknown[] };

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(cleanJson.cleanMarkers).toHaveLength(0);
  });
});
