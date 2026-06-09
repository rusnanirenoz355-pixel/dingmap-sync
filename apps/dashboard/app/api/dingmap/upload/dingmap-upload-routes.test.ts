import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";
import { POST as continuePost } from "./continue/route";
import { POST as uploadPost } from "./route";
import { GET as statusGet } from "./status/route";

const tempFiles: string[] = [];

afterEach(() => {
  for (const filePath of tempFiles.splice(0)) {
    rmSync(filePath, { force: true });
  }
  const globalStore = globalThis as typeof globalThis & {
    __dingmapUploadStore?: { currentJob: unknown };
  };
  if (globalStore.__dingmapUploadStore) {
    globalStore.__dingmapUploadStore.currentJob = null;
  } else {
    globalStore.__dingmapUploadStore = { currentJob: null };
  }
  delete process.env.DATABASE_URL;
});

describe("dingmap upload API routes", () => {
  it("rejects export filenames that include path traversal", async () => {
    const response = await uploadPost(
      new Request("http://localhost/api/dingmap/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "../dingmap-import-20260608-093000.xlsx" }),
      }),
    );
    const json = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("导出文件名无效");
  });

  it("returns current status and recent export metadata", async () => {
    const response = await statusGet();
    const json = (await response.json()) as {
      job: unknown;
      recentExports: unknown;
      platformOptions: Array<{ key: string; label: string }>;
    };

    expect(response.status).toBe(200);
    expect(json).toHaveProperty("job");
    expect(Array.isArray(json.recentExports)).toBe(true);
    expect(json.platformOptions.map((platform) => platform.key)).toEqual([
      "other",
      "shangchao",
      "taobao",
      "meituan",
      "maicai",
      "mianshi",
    ]);
  });

  it("rejects unknown platform keys before creating an upload job", async () => {
    const response = await uploadPost(
      new Request("http://localhost/api/dingmap/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: "dingmap-import-20260608-093000.xlsx", platform: "bad" }),
      }),
    );
    const json = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("平台");
  });

  it("blocks exports with more than 2000 data rows before browser upload starts", async () => {
    const databasePath = join(process.cwd(), "data", "test-dingmap-upload-job.db");
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    tempFiles.push(databasePath);
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT,
        action TEXT NOT NULL,
        before_json TEXT,
        after_json TEXT,
        status TEXT NOT NULL,
        error_msg TEXT,
        screenshot_path TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    database.close();

    const filename = "dingmap-import-20260609-120001.xlsx";
    await writeExportWorkbook(filename, 2_001);

    const response = await uploadPost(
      new Request("http://localhost/api/dingmap/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, platform: "mianshi" }),
      }),
    );
    const json = (await response.json()) as {
      job?: { status: string; stage?: string; dataRows?: number; maxRows?: number };
    };

    expect(response.status).toBe(200);
    expect(json.job).toMatchObject({
      status: "blocked",
      stage: "row-limit",
      dataRows: 2_001,
      maxRows: 2_000,
    });
  });

  it("does not continue when there is no login-waiting upload job", async () => {
    const response = await continuePost();
    const json = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("没有可继续的钉图上传任务");
  });
});

async function writeExportWorkbook(filename: string, dataRows: number): Promise<void> {
  const outputDir = join(process.cwd(), "data", "exports");
  mkdirSync(outputDir, { recursive: true });
  const filePath = join(outputDir, filename);
  tempFiles.push(filePath);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(["标记名称", "详细地址", "经度", "纬度", "备注", "字段一", "字段二"]);
  for (let index = 0; index < dataRows; index += 1) {
    sheet.addRow([`合成站点${index + 1}`, "合成地址", "", "", "", "", ""]);
  }

  await workbook.xlsx.writeFile(filePath);
}
