import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { DINGMAP_IMPORT_HEADERS } from "@dingmap-sync/dingmap/export-template";
import {
  buildYouzhaoBatchFilenames,
  buildYouzhaoExportFilename,
  exportYouzhaoDingmapTemplates,
  listYouzhaoExportCities,
} from "./youzhao-dingmap-export";

const databasePath = join(process.cwd(), "data", "test-youzhao-dingmap-export.db");
const outputDir = join(process.cwd(), "data", "exports", "test-youzhao");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

const hangzhou = "\u676d\u5dde";
const shanghai = "\u4e0a\u6d77";
const meituanLayer = "\u7f8e\u56e2\u70b9";
const taobaoLayer = "\u6dd8\u5b9d\u70b9";
const groceryLayer = "\u4e70\u83dc\u70b9";
const otherLayer = "\u5176\u4ed6\u70b9";
const supermarketLayer = "\u5546\u8d85\u70b9";

describe("youzhao DingMap grouped export", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${databasePath}`;
    if (existsSync(databasePath)) {
      rmSync(databasePath);
    }
    if (existsSync(outputDir)) {
      rmSync(outputDir, { recursive: true, force: true });
    }
    mkdirSync(dirname(databasePath), { recursive: true });
    const database = new DatabaseSync(databasePath);
    database.exec(schemaSql);
    database.close();
  });

  it("exports one city and one target layer without empty layer files", async () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, {
      sourceId: "hz-meituan",
      city: hangzhou,
      businessLine: "\u7f8e\u56e2",
      siteName: "Synthetic Meituan Site",
      address: "Synthetic Meituan Road",
    });
    insertYouzhaoMarker(database, {
      sourceId: "hz-supermarket",
      city: hangzhou,
      businessLine: "\u76d2\u9a6c",
      siteName: "Synthetic Super Site",
      address: "Synthetic Super Road",
    });
    insertYouzhaoMarker(database, {
      sourceId: "sh-meituan",
      city: shanghai,
      businessLine: "\u7f8e\u56e2",
      siteName: "Synthetic Other City Site",
      address: "Synthetic Other City Road",
    });
    insertYouzhaoMarker(database, {
      sourceId: "hz-deleted",
      city: hangzhou,
      businessLine: "\u7f8e\u56e2",
      siteName: "Synthetic Deleted Site",
      address: "Synthetic Deleted Road",
      deletedAt: "2026-06-14T00:00:00.000Z",
    });
    insertNonYouzhaoMarker(database, "manual_paste");
    insertNonYouzhaoMarker(database, "excel");
    database.close();

    const result = await exportYouzhaoDingmapTemplates({
      city: hangzhou,
      targetLayer: meituanLayer,
      outputDir,
    });

    expect(result).toMatchObject({
      city: hangzhou,
      targetLayer: meituanLayer,
      totalExported: 1,
      missingCityExcluded: 0,
      message: null,
    });
    expect(result.files).toEqual([
      {
        targetLayer: meituanLayer,
        count: 1,
        filename: `\u4f18\u62db-${hangzhou}-${meituanLayer}.xlsx`,
        downloadUrl: `/api/dingmap/download/${encodeURIComponent(`\u4f18\u62db-${hangzhou}-${meituanLayer}.xlsx`)}`,
        batch: 1,
      },
    ]);
    expect(existsSync(join(outputDir, `\u4f18\u62db-${hangzhou}-${supermarketLayer}.xlsx`))).toBe(false);
    const rows = await readSheetRows(join(outputDir, result.files[0]?.filename ?? ""));
    expect(rows.headers).toEqual(DINGMAP_IMPORT_HEADERS);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.["\u7ecf\u5ea6"]).toBe("");
    expect(rows.rows[0]?.["\u7eac\u5ea6"]).toBe("");
    expect(JSON.stringify(rows.rows)).not.toContain("undefined");
  });

  it("matches city-scoped exports when raw city values include the city suffix", async () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, {
      sourceId: "hz-city-suffix",
      city: "\u676d\u5dde\u5e02",
      businessLine: "\u7f8e\u56e2",
      siteName: "Synthetic City Suffix Site",
      address: "Synthetic City Suffix Road",
    });
    database.close();

    const result = await exportYouzhaoDingmapTemplates({
      city: hangzhou,
      targetLayer: meituanLayer,
      outputDir,
    });

    expect(result.totalExported).toBe(1);
    expect(result.files[0]).toMatchObject({
      targetLayer: meituanLayer,
      count: 1,
      filename: `\u4f18\u62db-${hangzhou}-${meituanLayer}.xlsx`,
    });
  });

  it("lists export cities from persisted active youzhao web raw metadata only", () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, {
      sourceId: "hz-city-a",
      city: " \u676d\u5dde\u5e02 ",
      businessLine: "\u7f8e\u56e2",
    });
    insertYouzhaoMarker(database, {
      sourceId: "sh-city-a",
      city: "\u4e0a\u6d77",
      businessLine: "\u7f8e\u56e2",
    });
    insertYouzhaoMarker(database, {
      sourceId: "hz-city-b",
      city: "\u676d\u5dde",
      businessLine: "\u53ee\u549a",
    });
    insertYouzhaoMarker(database, {
      sourceId: "deleted-city",
      city: "\u82cf\u5dde",
      businessLine: "\u7f8e\u56e2",
      deletedAt: "2026-06-14T00:00:00.000Z",
    });
    insertYouzhaoMarker(database, {
      sourceId: "missing-city",
      city: "",
      businessLine: "\u7f8e\u56e2",
    });
    insertNonYouzhaoMarker(database, "manual_paste");
    insertNonYouzhaoMarker(database, "excel");
    database.close();

    expect(listYouzhaoExportCities()).toEqual(["\u676d\u5dde", "\u4e0a\u6d77"]);
  });

  it("exports one city and all target layers by layer without empty files", async () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, { sourceId: "hz-meituan", city: hangzhou, businessLine: "\u7f8e\u56e2" });
    insertYouzhaoMarker(database, { sourceId: "hz-grocery", city: hangzhou, businessLine: "\u5c0f\u8c61\u914d\u9001" });
    insertYouzhaoMarker(database, { sourceId: "hz-super", city: hangzhou, businessLine: "\u76d2\u9a6c" });
    insertYouzhaoMarker(database, { sourceId: "sh-meituan", city: shanghai, businessLine: "\u7f8e\u56e2" });
    database.close();

    const result = await exportYouzhaoDingmapTemplates({ city: hangzhou, targetLayer: "all", outputDir });

    expect(result.city).toBe(hangzhou);
    expect(result.targetLayer).toBe("all");
    expect(result.totalExported).toBe(3);
    expect(result.files.map((file) => file.targetLayer)).toEqual([meituanLayer, groceryLayer, supermarketLayer]);
    expect(result.files.map((file) => file.filename)).toEqual([
      `\u4f18\u62db-${hangzhou}-${meituanLayer}.xlsx`,
      `\u4f18\u62db-${hangzhou}-${groceryLayer}.xlsx`,
      `\u4f18\u62db-${hangzhou}-${supermarketLayer}.xlsx`,
    ]);
    expect(existsSync(join(outputDir, `\u4f18\u62db-${hangzhou}-${taobaoLayer}.xlsx`))).toBe(false);
    expect(existsSync(join(outputDir, `\u4f18\u62db-${hangzhou}-${otherLayer}.xlsx`))).toBe(false);
  });

  it("exports all cities and one target layer into a merged file", async () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, { sourceId: "hz-meituan", city: hangzhou, businessLine: "\u7f8e\u56e2" });
    insertYouzhaoMarker(database, { sourceId: "sh-meituan", city: shanghai, businessLine: "\u7f8e\u56e2" });
    insertYouzhaoMarker(database, { sourceId: "hz-grocery", city: hangzhou, businessLine: "\u5c0f\u8c61\u914d\u9001" });
    database.close();

    const result = await exportYouzhaoDingmapTemplates({
      city: "all",
      targetLayer: meituanLayer,
      outputDir,
    });

    expect(result.city).toBe("all");
    expect(result.targetLayer).toBe(meituanLayer);
    expect(result.totalExported).toBe(2);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      targetLayer: meituanLayer,
      count: 2,
      filename: `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${meituanLayer}.xlsx`,
    });
    const rows = await readSheetRows(join(outputDir, result.files[0]?.filename ?? ""));
    expect(rows.rows).toHaveLength(2);
  });

  it("exports all cities and all target layers while excluding missing city metadata", async () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, { sourceId: "hz-meituan", city: hangzhou, businessLine: "\u7f8e\u56e2" });
    insertYouzhaoMarker(database, { sourceId: "sh-grocery", city: shanghai, businessLine: "\u53ee\u549a" });
    insertYouzhaoMarker(database, { sourceId: "hz-super", city: hangzhou, businessLine: "\u76d2\u9a6c" });
    insertYouzhaoMarker(database, { sourceId: "missing-city", city: "", businessLine: "\u7f8e\u56e2" });
    database.close();

    const result = await exportYouzhaoDingmapTemplates({ city: "all", targetLayer: "all", outputDir });

    expect(result.city).toBe("all");
    expect(result.targetLayer).toBe("all");
    expect(result.totalExported).toBe(3);
    expect(result.missingCityExcluded).toBe(1);
    expect(result.message).toContain("1");
    expect(result.files.map((file) => file.targetLayer)).toEqual([meituanLayer, groceryLayer, supermarketLayer]);
    expect(result.files.map((file) => file.filename)).toEqual([
      `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${meituanLayer}.xlsx`,
      `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${groceryLayer}.xlsx`,
      `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${supermarketLayer}.xlsx`,
    ]);
  });

  it("returns an empty success result when a legal filter has no exportable data", async () => {
    const result = await exportYouzhaoDingmapTemplates({
      city: hangzhou,
      targetLayer: taobaoLayer,
      outputDir,
    });

    expect(result).toMatchObject({
      city: hangzhou,
      targetLayer: taobaoLayer,
      totalExported: 0,
      missingCityExcluded: 0,
      files: [],
      message: "\u5f53\u524d\u7b5b\u9009\u8303\u56f4\u6ca1\u6709\u53ef\u5bfc\u51fa\u6570\u636e",
    });
  });

  it("splits merged all-city files at the requested batch boundary", async () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, { sourceId: "hz-meituan-1", city: hangzhou, businessLine: "\u7f8e\u56e2" });
    insertYouzhaoMarker(database, { sourceId: "sh-meituan-2", city: shanghai, businessLine: "\u7f8e\u56e2" });
    insertYouzhaoMarker(database, { sourceId: "hz-meituan-3", city: hangzhou, businessLine: "\u7f8e\u56e2" });
    database.close();

    const result = await exportYouzhaoDingmapTemplates({
      city: "all",
      targetLayer: meituanLayer,
      outputDir,
      batchSize: 2,
    });

    expect(result.files.map((file) => file.filename)).toEqual([
      `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${meituanLayer}-\u7b2c1\u6279.xlsx`,
      `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${meituanLayer}-\u7b2c2\u6279.xlsx`,
    ]);
    expect(result.files.map((file) => file.count)).toEqual([2, 1]);
    await expect(readSheetRows(join(outputDir, result.files[0]?.filename ?? ""))).resolves.toMatchObject({
      rows: expect.any(Array),
    });
  });

  it("plans 2000-row DingMap batches at the required boundaries", () => {
    expect(buildYouzhaoBatchFilenames({
      city: "\u5168\u90e8\u57ce\u5e02",
      targetLayer: supermarketLayer,
      rowCount: 2000,
    })).toEqual([`\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${supermarketLayer}.xlsx`]);
    expect(buildYouzhaoBatchFilenames({
      city: "\u5168\u90e8\u57ce\u5e02",
      targetLayer: supermarketLayer,
      rowCount: 2001,
    })).toEqual([
      `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${supermarketLayer}-\u7b2c1\u6279.xlsx`,
      `\u4f18\u62db-\u5168\u90e8\u57ce\u5e02-${supermarketLayer}-\u7b2c2\u6279.xlsx`,
    ]);
  });

  it("marks smoke exports as partial data without changing full filenames", () => {
    expect(buildYouzhaoExportFilename({
      city: hangzhou,
      targetLayer: meituanLayer,
      partial: true,
    })).toBe(`\u4f18\u62db-${hangzhou}-${meituanLayer}-\u90e8\u5206\u6570\u636e.xlsx`);
    expect(buildYouzhaoExportFilename({
      city: hangzhou,
      targetLayer: meituanLayer,
      partial: false,
    })).toBe(`\u4f18\u62db-${hangzhou}-${meituanLayer}.xlsx`);
  });

  it("validates city scope, target layer, and sanitizes unsafe filename characters", async () => {
    await expect(exportYouzhaoDingmapTemplates({ city: "", outputDir })).rejects.toThrow(
      "\u57ce\u5e02\u8303\u56f4",
    );
    await expect(exportYouzhaoDingmapTemplates({ city: "\u5168\u56fd", outputDir })).rejects.toThrow(
      "city = \"all\"",
    );
    await expect(exportYouzhaoDingmapTemplates({
      city: hangzhou,
      targetLayer: "Synthetic Invalid Layer",
      outputDir,
    })).rejects.toThrow("\u76ee\u6807\u56fe\u5c42");

    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, {
      sourceId: "job-safe-name",
      city: "\u676d/\u5dde:*?",
      businessLine: "\u7f8e\u56e2",
      siteName: "Synthetic Safe Site",
      address: "Synthetic Safe Road",
    });
    database.close();

    const result = await exportYouzhaoDingmapTemplates({ city: "\u676d/\u5dde:*?", outputDir });

    expect(result.files[0]?.filename).toBe(`\u4f18\u62db-\u676d_\u5dde___-${meituanLayer}.xlsx`);
    expect(result.files[0]?.filename).not.toMatch(/[\\/:*?"<>|]/);
  });
});

function insertYouzhaoMarker(
  database: DatabaseSync,
  input: {
    sourceId: string;
    city: string;
    businessLine: string;
    siteName?: string;
    address?: string;
    jobTitle?: string;
    salary?: string;
    welfare?: string;
    settlement?: string;
    deletedAt?: string | null;
  },
): void {
  database
    .prepare(
      `
        INSERT INTO clean_markers (
          source, source_id, site_name, address, longitude, latitude,
          station_manager, phone, salary, welfare, job_title, remark,
          origin_type, sync_action, sync_status, current_hash, merge_key, deleted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      "youzhao",
      input.sourceId,
      input.siteName ?? `Synthetic Site ${input.sourceId}`,
      input.address ?? `Synthetic Road ${input.sourceId}`,
      120.1,
      30.2,
      "Manager",
      syntheticPhone,
      input.salary ?? "Synthetic salary",
      input.welfare ?? "Synthetic welfare",
      input.jobTitle ?? "Synthetic Job",
      input.settlement ?? "Synthetic settlement",
      "web",
      "create",
      "pending",
      `hash-${input.sourceId}`,
      `source_id:youzhao:${input.sourceId}`,
      input.deletedAt ?? null,
    );
  database
    .prepare(
      `
        INSERT INTO raw_records (
          source, source_id, raw_title, raw_address, raw_json, parse_status
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      "youzhao",
      `raw-${input.sourceId}`,
      input.siteName ?? `Synthetic Site ${input.sourceId}`,
      input.address ?? `Synthetic Road ${input.sourceId}`,
      JSON.stringify({
        raw: {
          city: input.city,
          businessLine: input.businessLine,
          "\u4e1a\u52a1\u7ebf": input.businessLine,
        },
        mapped: {
          sourceId: input.sourceId,
        },
      }),
      "valid",
    );
}

function insertNonYouzhaoMarker(database: DatabaseSync, source: "manual_paste" | "excel"): void {
  database
    .prepare(
      `
        INSERT INTO clean_markers (
          source, source_id, site_name, address, origin_type, sync_action, sync_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(source, `${source}-1`, "Synthetic Non Youzhao", "Synthetic Road", source, "create", "pending");
}

async function readSheetRows(
  filePath: string,
): Promise<{ headers: string[]; rows: Array<Record<string, string | number>> }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet("Sheet1");
  if (!worksheet) {
    throw new Error("Sheet1 missing");
  }
  const headers = DINGMAP_IMPORT_HEADERS.map((header, index) =>
    String(worksheet.getRow(1).getCell(index + 1).value ?? ""),
  );
  const rows: Array<Record<string, string | number>> = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    rows.push(Object.fromEntries(
      DINGMAP_IMPORT_HEADERS.map((header, index) => [
        header,
        normalizeCellValue(row.getCell(index + 1).value),
      ]),
    ) as Record<string, string | number>);
  }
  return { headers, rows };
}

function normalizeCellValue(value: ExcelJS.CellValue): string | number {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return "text" in value ? String(value.text ?? "") : String(value);
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return value;
}
