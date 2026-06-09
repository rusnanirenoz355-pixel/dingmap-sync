import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./[filename]/route";

const exportDir = join(process.cwd(), "data", "exports");
const outsideExportFile = join(process.cwd(), "data", "dingmap-import-20260608-093000.xlsx");
const testFiles = [
  "dingmap-import-20260608-093000.xlsx",
  "dingmap-import-测试导出-20260609-144630.xlsx",
  "dingmap-import-美团点-测试导出-20260609-144631.xlsx",
];

describe("dingmap download route", () => {
  beforeEach(() => {
    mkdirSync(exportDir, { recursive: true });
    mkdirSync(dirname(outsideExportFile), { recursive: true });
    for (const filename of testFiles) {
      writeFileSync(join(exportDir, filename), `synthetic ${filename}`);
    }
    writeFileSync(outsideExportFile, "outside exports");
  });

  afterEach(() => {
    for (const filename of testFiles) {
      const filePath = join(exportDir, filename);
      if (existsSync(filePath)) {
        rmSync(filePath);
      }
    }
    if (existsSync(outsideExportFile)) {
      rmSync(outsideExportFile);
    }
  });

  it("downloads an old English timestamp filename", async () => {
    const filename = "dingmap-import-20260608-093000.xlsx";
    const response = await requestDownload(filename);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Length")).toBe(String(`synthetic ${filename}`.length));
  });

  it("downloads Chinese filenames with RFC 5987 content disposition", async () => {
    const filename = "dingmap-import-测试导出-20260609-144630.xlsx";
    const response = await requestDownload(encodeURIComponent(filename));
    const disposition = response.headers.get("Content-Disposition") ?? "";

    expect(response.status).toBe(200);
    expect(disposition).toContain('attachment; filename="dingmap-import.xlsx"');
    expect(disposition).toContain(`filename*=UTF-8''${encodeURIComponent(filename)}`);
  });

  it("downloads filenames containing a Chinese platform label", async () => {
    const filename = "dingmap-import-美团点-测试导出-20260609-144631.xlsx";
    const response = await requestDownload(encodeURIComponent(filename));

    expect(response.status).toBe(200);
  });

  it("returns a clear error for missing files", async () => {
    const response = await requestDownload("dingmap-import-20260608-093001.xlsx");
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(json.error).toContain("不存在");
  });

  it("rejects traversal attempts and files outside data exports", async () => {
    const traversal = await requestDownload("..%2Fdingmap-import-20260608-093000.xlsx");
    const absolute = await requestDownload(encodeURIComponent(outsideExportFile));

    expect(traversal.status).toBe(400);
    expect(absolute.status).toBe(400);
  });
});

async function requestDownload(filename: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/dingmap/download/${filename}`), {
    params: Promise.resolve({ filename }),
  });
}
