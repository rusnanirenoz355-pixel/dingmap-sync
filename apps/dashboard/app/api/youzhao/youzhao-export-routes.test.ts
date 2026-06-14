import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportYouzhaoDingmapTemplates } from "@dingmap-sync/db/youzhao-dingmap-export";
import { getYouzhaoCollectionTask } from "@dingmap-sync/db/youzhao-collection-task";
import { GET as downloadGet } from "../dingmap/download/[filename]/route";
import { POST as exportPost } from "./export/route";

vi.mock("@dingmap-sync/db/youzhao-dingmap-export", () => ({
  exportYouzhaoDingmapTemplates: vi.fn(),
}));

vi.mock("@dingmap-sync/db/youzhao-collection-task", () => ({
  getYouzhaoCollectionTask: vi.fn(),
}));

const hangzhou = "\u676d\u5dde";
const meituanLayer = "\u7f8e\u56e2\u70b9";
const groceryLayer = "\u4e70\u83dc\u70b9";
const exportDir = join(process.cwd(), "data", "exports");
const safeChineseFilename = `\u4f18\u62db-${hangzhou}-${groceryLayer}.xlsx`;

describe("youzhao DingMap export API routes", () => {
  beforeEach(() => {
    vi.mocked(exportYouzhaoDingmapTemplates).mockReset();
    vi.mocked(getYouzhaoCollectionTask).mockReset();
    mkdirSync(exportDir, { recursive: true });
    const filePath = join(exportDir, safeChineseFilename);
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  });

  it("exports one completed city with target layer filters and redacted file summaries", async () => {
    vi.mocked(getYouzhaoCollectionTask).mockReturnValue(taskState({
      mode: "full",
      status: "completed",
      countConsistencyPassed: true,
    }));
    vi.mocked(exportYouzhaoDingmapTemplates).mockResolvedValue(exportResult({
      city: hangzhou,
      targetLayer: "all",
      totalExported: 7,
      files: [
        {
          targetLayer: groceryLayer,
          count: 7,
          filename: `\u4f18\u62db-${hangzhou}-${groceryLayer}.xlsx`,
          downloadUrl: `/api/dingmap/download/${encodeURIComponent(`\u4f18\u62db-${hangzhou}-${groceryLayer}.xlsx`)}`,
          batch: 1,
        },
      ],
    }));

    const response = await exportPost(jsonRequest({
      city: hangzhou,
      targetLayer: "all",
      rows: [{ phone: "19900000000", address: "Synthetic forbidden client row" }],
    }));
    const json = await response.json() as {
      totalExported: number;
      files: Array<{ filename: string; downloadUrl: string }>;
    };

    expect(response.status).toBe(200);
    expect(json.totalExported).toBe(7);
    expect(json.files[0]?.filename).toBe(`\u4f18\u62db-${hangzhou}-${groceryLayer}.xlsx`);
    expect(JSON.stringify(json)).not.toContain("19900000000");
    expect(JSON.stringify(json)).not.toContain("Synthetic forbidden client row");
    expect(getYouzhaoCollectionTask).toHaveBeenCalledWith(undefined, { city: hangzhou, mode: "full" });
    expect(exportYouzhaoDingmapTemplates).toHaveBeenCalledWith({ city: hangzhou, targetLayer: "all" });
  });

  it("exports all local cities without requiring or starting a full task", async () => {
    vi.mocked(exportYouzhaoDingmapTemplates).mockResolvedValue(exportResult({
      city: "all",
      targetLayer: meituanLayer,
      totalExported: 2,
      files: [
        {
          targetLayer: meituanLayer,
          count: 2,
          filename: `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${meituanLayer}.xlsx`,
          downloadUrl: `/api/dingmap/download/${encodeURIComponent(`\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${meituanLayer}.xlsx`)}`,
          batch: 1,
        },
      ],
    }));

    const response = await exportPost(jsonRequest({ city: "all", targetLayer: meituanLayer }));
    const json = await response.json() as { city: string; targetLayer: string; totalExported: number };

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ city: "all", targetLayer: meituanLayer, totalExported: 2 });
    expect(getYouzhaoCollectionTask).not.toHaveBeenCalled();
    expect(exportYouzhaoDingmapTemplates).toHaveBeenCalledWith({ city: "all", targetLayer: meituanLayer });
  });

  it("rejects complete single-city export until full task is completed and count checked", async () => {
    vi.mocked(getYouzhaoCollectionTask).mockReturnValue(taskState({
      mode: "smoke",
      status: "smoke_completed",
      countConsistencyPassed: null,
    }));

    const response = await exportPost(jsonRequest({ city: hangzhou, targetLayer: meituanLayer }));
    const json = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("full");
    expect(exportYouzhaoDingmapTemplates).not.toHaveBeenCalled();
  });

  it("passes partial export mode without full task gating", async () => {
    vi.mocked(exportYouzhaoDingmapTemplates).mockResolvedValue(exportResult({
      city: hangzhou,
      targetLayer: groceryLayer,
      totalExported: 7,
      files: [
        {
          targetLayer: groceryLayer,
          count: 7,
          filename: `\u4f18\u62db-${hangzhou}-${groceryLayer}-\u90e8\u5206\u6570\u636e.xlsx`,
          downloadUrl: `/api/dingmap/download/${encodeURIComponent(`\u4f18\u62db-${hangzhou}-${groceryLayer}-\u90e8\u5206\u6570\u636e.xlsx`)}`,
          batch: 1,
        },
      ],
    }));

    const response = await exportPost(jsonRequest({ city: hangzhou, targetLayer: groceryLayer, partial: true }));

    expect(response.status).toBe(200);
    expect(getYouzhaoCollectionTask).not.toHaveBeenCalled();
    expect(exportYouzhaoDingmapTemplates).toHaveBeenCalledWith({
      city: hangzhou,
      targetLayer: groceryLayer,
      partial: true,
    });
  });

  it("returns HTTP 200 with an empty files array when a legal filter has no data", async () => {
    vi.mocked(exportYouzhaoDingmapTemplates).mockResolvedValue(exportResult({
      city: "all",
      targetLayer: meituanLayer,
      totalExported: 0,
      files: [],
      message: "\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u6ca1\u6709\u53ef\u5bfc\u51fa\u6570\u636e",
    }));

    const response = await exportPost(jsonRequest({ city: "all", targetLayer: meituanLayer }));
    const json = await response.json() as { totalExported: number; files: unknown[]; message: string };

    expect(response.status).toBe(200);
    expect(json.totalExported).toBe(0);
    expect(json.files).toEqual([]);
    expect(json.message).toContain("\u6ca1\u6709\u53ef\u5bfc\u51fa\u6570\u636e");
  });

  it("rejects missing city before exporting", async () => {
    const response = await exportPost(jsonRequest({ city: "" }));
    const json = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("\u57ce\u5e02");
    expect(exportYouzhaoDingmapTemplates).not.toHaveBeenCalled();
  });

  it("downloads only safe files from data exports with encoded Chinese filenames", async () => {
    writeFileSync(join(exportDir, safeChineseFilename), "xlsx");

    const response = await downloadGet(new Request("http://localhost/download"), {
      params: Promise.resolve({ filename: safeChineseFilename }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("filename*=UTF-8''");
    expect(response.headers.get("Content-Disposition")).toContain(
      encodeURIComponent(safeChineseFilename),
    );
  });

  it("rejects download path traversal and absolute paths", async () => {
    const traversal = await downloadGet(new Request("http://localhost/download"), {
      params: Promise.resolve({ filename: "../app.db" }),
    });
    const absolute = await downloadGet(new Request("http://localhost/download"), {
      params: Promise.resolve({ filename: "C:/Users/EDY/Documents/dingmap-sync/data/app.db" }),
    });

    expect(traversal.status).toBe(400);
    expect(absolute.status).toBe(400);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/youzhao/export", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function taskState(overrides: Record<string, unknown> = {}) {
  return {
    city: hangzhou,
    mode: "smoke",
    status: "smoke_completed",
    currentPage: 2,
    nextPage: 3,
    pageSize: 20,
    processedPages: 2,
    processedItems: 40,
    totalFromApi: 786,
    totalPages: 40,
    completedPages: [1, 2],
    counts: {
      imported: 20,
      duplicate: 20,
      update_candidate: 0,
      invalid: 0,
      filteredNonRecruiting: 0,
    },
    targetLayerCounts: {},
    failedPages: [],
    countConsistencyPassed: null,
    countDifference: null,
    ...overrides,
  } as never;
}

function exportResult(overrides: Record<string, unknown> = {}) {
  return {
    city: hangzhou,
    targetLayer: "all",
    totalExported: 0,
    missingCityExcluded: 0,
    files: [],
    message: null,
    ...overrides,
  } as never;
}
