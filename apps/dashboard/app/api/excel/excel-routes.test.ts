import ExcelJS from "exceljs";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as importPost } from "./import/route";
import { POST as previewPost } from "./preview/route";

const databasePath = join(process.cwd(), "data", "test-excel-routes.db");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

async function buildExcelFile(filename: string): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet A");
  sheet.addRow(["站点名称", "地址", "电话", "联系人"]);
  sheet.addRow(["Excel Route Site", "Excel Route Road", syntheticPhone, "Manager R"]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new File([buffer], filename, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("excel import API routes", () => {
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

  it("previews and imports an xlsx file without returning absolute paths", async () => {
    const formData = new FormData();
    formData.set("file", await buildExcelFile("source.xlsx"));

    const previewResponse = await previewPost(
      new Request("http://localhost/api/excel/preview", {
        method: "POST",
        body: formData,
      }),
    );
    const previewJson = (await previewResponse.json()) as {
      filename: string;
      sheetNames: string[];
      selectedSheetName: string;
      rawRows: unknown[];
      rows: Array<{ mapped: { siteName?: string; source?: string; originType?: string } }>;
      summary: { valid: number };
    };

    expect(previewResponse.status).toBe(200);
    expect(previewJson.filename).toBe("source.xlsx");
    expect(previewJson.filename).not.toContain(":");
    expect(previewJson.sheetNames).toEqual(["Sheet A"]);
    expect(previewJson.selectedSheetName).toBe("Sheet A");
    expect(previewJson.rows[0]?.mapped).toMatchObject({
      siteName: "Excel Route Site",
      source: "excel",
      originType: "excel",
    });
    expect(previewJson.summary.valid).toBe(1);

    const importResponse = await importPost(
      new Request("http://localhost/api/excel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: previewJson.rawRows }),
      }),
    );
    const importJson = (await importResponse.json()) as {
      inserted: number;
      updated: number;
      skippedDuplicate: number;
      skippedInvalid: number;
      updateCandidate: number;
      cleanMarkers: Array<{ source: string; originType: string; siteName: string }>;
    };

    expect(importResponse.status).toBe(200);
    expect(importJson).toMatchObject({
      inserted: 1,
      updated: 0,
      skippedDuplicate: 0,
      skippedInvalid: 0,
      updateCandidate: 0,
    });
    expect(importJson.cleanMarkers[0]).toMatchObject({
      source: "excel",
      originType: "excel",
      siteName: "Excel Route Site",
    });

    const duplicateFormData = new FormData();
    duplicateFormData.set("file", await buildExcelFile("source.xlsx"));
    const duplicatePreviewResponse = await previewPost(
      new Request("http://localhost/api/excel/preview", {
        method: "POST",
        body: duplicateFormData,
      }),
    );
    const duplicatePreviewJson = (await duplicatePreviewResponse.json()) as {
      summary: { duplicate: number };
      rows: Array<{ status: string }>;
    };

    expect(duplicatePreviewJson.summary.duplicate).toBe(1);
    expect(duplicatePreviewJson.rows[0]?.status).toBe("duplicate");
  });

  it("rejects non-xlsx uploads", async () => {
    const formData = new FormData();
    formData.set("file", new File(["plain text"], "source.txt", { type: "text/plain" }));

    const response = await previewPost(
      new Request("http://localhost/api/excel/preview", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
  });
});
