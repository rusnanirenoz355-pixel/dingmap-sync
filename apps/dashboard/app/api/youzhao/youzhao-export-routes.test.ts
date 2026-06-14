import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportYouzhaoDingmapTemplates } from "@dingmap-sync/db/youzhao-dingmap-export";
import { GET as downloadGet } from "../dingmap/download/[filename]/route";
import { POST as exportPost } from "./export/route";

vi.mock("@dingmap-sync/db/youzhao-dingmap-export", () => ({
  exportYouzhaoDingmapTemplates: vi.fn(),
}));

const exportDir = join(process.cwd(), "data", "exports");
const safeChineseFilename = "优招-杭州-买菜点.xlsx";

describe("youzhao DingMap export API routes", () => {
  beforeEach(() => {
    vi.mocked(exportYouzhaoDingmapTemplates).mockReset();
    mkdirSync(exportDir, { recursive: true });
    const filePath = join(exportDir, safeChineseFilename);
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  });

  it("exports by city only and returns a redacted grouped summary", async () => {
    vi.mocked(exportYouzhaoDingmapTemplates).mockResolvedValue({
      city: "杭州",
      totalRows: 20,
      groups: [
        {
          targetLayer: "买菜点",
          rowCount: 7,
          files: ["优招-杭州-买菜点.xlsx"],
        },
        {
          targetLayer: "商超点",
          rowCount: 13,
          files: ["优招-杭州-商超点.xlsx"],
        },
      ],
    });

    const response = await exportPost(jsonRequest({
      city: "杭州",
      rows: [{ phone: "19900000000", address: "Synthetic forbidden client row" }],
    }));
    const json = await response.json() as {
      totalRows: number;
      groups: Array<{ files: string[] }>;
    };

    expect(response.status).toBe(200);
    expect(json.totalRows).toBe(20);
    expect(json.groups.flatMap((group) => group.files)).toEqual([
      "优招-杭州-买菜点.xlsx",
      "优招-杭州-商超点.xlsx",
    ]);
    expect(JSON.stringify(json)).not.toContain("19900000000");
    expect(JSON.stringify(json)).not.toContain("Synthetic forbidden client row");
    expect(exportYouzhaoDingmapTemplates).toHaveBeenCalledWith({ city: "杭州" });
  });

  it("passes partial data export mode only when requested", async () => {
    vi.mocked(exportYouzhaoDingmapTemplates).mockResolvedValue({
      city: "杭州",
      totalRows: 20,
      groups: [
        {
          targetLayer: "买菜点",
          rowCount: 7,
          files: ["优招-杭州-买菜点-部分数据.xlsx"],
        },
      ],
    });

    const response = await exportPost(jsonRequest({ city: "杭州", partial: true }));

    expect(response.status).toBe(200);
    expect(exportYouzhaoDingmapTemplates).toHaveBeenCalledWith({
      city: "杭州",
      partial: true,
    });
  });

  it("rejects missing city before exporting", async () => {
    const response = await exportPost(jsonRequest({ city: "" }));
    const json = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("城市");
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
