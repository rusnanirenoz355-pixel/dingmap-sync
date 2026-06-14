import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { DINGMAP_IMPORT_HEADERS } from "@dingmap-sync/dingmap/export-template";
import {
  buildYouzhaoBatchFilenames,
  exportYouzhaoDingmapTemplates,
} from "./youzhao-dingmap-export";

const databasePath = join(process.cwd(), "data", "test-youzhao-dingmap-export.db");
const outputDir = join(process.cwd(), "data", "exports", "test-youzhao");
const schemaSql = readFileSync(join(process.cwd(), "packages", "db", "schema.sql"), "utf8");
const syntheticPhone = ["199", "0000", "0000"].join("");

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

  it("exports active youzhao web rows for one city grouped by target layer", async () => {
    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, {
      sourceId: "job-buy-a",
      city: "杭州",
      businessLine: "小象配送",
      siteName: "Synthetic Shared Site",
      address: "Synthetic Shared Road",
      jobTitle: "Synthetic Job A",
      salary: "Synthetic salary A",
      welfare: "Synthetic welfare A",
      settlement: "Synthetic settlement A",
    });
    insertYouzhaoMarker(database, {
      sourceId: "job-buy-b",
      city: "杭州",
      businessLine: "叮咚",
      siteName: "Synthetic Shared Site",
      address: "Synthetic Shared Road",
      jobTitle: "Synthetic Job B",
      salary: "Synthetic salary B",
      welfare: "Synthetic welfare B",
      settlement: "Synthetic settlement B",
    });
    insertYouzhaoMarker(database, {
      sourceId: "job-super-a",
      city: "杭州",
      businessLine: "盒马",
      siteName: "Synthetic Super Site",
      address: "Synthetic Super Road",
      jobTitle: "Synthetic Super Job",
      salary: "Synthetic salary C",
      welfare: "Synthetic welfare C",
      settlement: "Synthetic settlement C",
    });
    insertYouzhaoMarker(database, {
      sourceId: "job-other-city",
      city: "上海",
      businessLine: "盒马",
      siteName: "Other City Site",
      address: "Other City Road",
    });
    insertYouzhaoMarker(database, {
      sourceId: "job-deleted",
      city: "杭州",
      businessLine: "美团",
      siteName: "Deleted Site",
      address: "Deleted Road",
      deletedAt: "2026-06-14T00:00:00.000Z",
    });
    insertNonYouzhaoMarker(database, "manual_paste");
    insertNonYouzhaoMarker(database, "excel");
    database.close();

    const result = await exportYouzhaoDingmapTemplates({ city: "杭州", outputDir });

    expect(result.city).toBe("杭州");
    expect(result.totalRows).toBe(3);
    expect(result.groups).toEqual([
      {
        targetLayer: "买菜点",
        rowCount: 2,
        files: ["优招-杭州-买菜点.xlsx"],
      },
      {
        targetLayer: "商超点",
        rowCount: 1,
        files: ["优招-杭州-商超点.xlsx"],
      },
    ]);

    const buyRows = await readSheetRows(join(outputDir, "优招-杭州-买菜点.xlsx"));
    expect(buyRows.headers).toEqual(DINGMAP_IMPORT_HEADERS);
    expect(buyRows.rows).toHaveLength(2);
    expect(buyRows.rows.map((row) => row["标记名称"])).toEqual([
      "Synthetic Shared Site",
      "Synthetic Shared Site",
    ]);
    expect(buyRows.rows[0]).toMatchObject({
      详细地址: "Synthetic Shared Road",
      经度: "",
      纬度: "",
      字段一: `Manager ${syntheticPhone}`,
      字段二: "Synthetic settlement A",
    });
    expect(String(buyRows.rows[0]?.备注)).toContain("【岗位名称】\nSynthetic Job A");
    expect(String(buyRows.rows[0]?.备注)).toContain("【薪资方案】\nSynthetic salary A");
    expect(String(buyRows.rows[0]?.备注)).toContain("【新人政策】\nSynthetic welfare A");
    expect(String(buyRows.rows[0]?.备注)).not.toMatch(/undefined|null/);

    const superRows = await readSheetRows(join(outputDir, "优招-杭州-商超点.xlsx"));
    expect(superRows.rows).toHaveLength(1);
    expect(superRows.rows[0]?.字段二).toBe("Synthetic settlement C");
    expect(existsSync(join(outputDir, "优招-杭州-美团点.xlsx"))).toBe(false);
    expect(existsSync(join(outputDir, "优招-杭州-淘宝点.xlsx"))).toBe(false);
    expect(existsSync(join(outputDir, "优招-杭州-其他点.xlsx"))).toBe(false);
  });

  it("plans 2000-row DingMap batches at the required boundaries", () => {
    expect(buildYouzhaoBatchFilenames({
      city: "杭州",
      targetLayer: "商超点",
      rowCount: 2000,
    })).toEqual(["优招-杭州-商超点.xlsx"]);
    expect(buildYouzhaoBatchFilenames({
      city: "杭州",
      targetLayer: "商超点",
      rowCount: 2001,
    })).toEqual(["优招-杭州-商超点-第1批.xlsx", "优招-杭州-商超点-第2批.xlsx"]);
    expect(buildYouzhaoBatchFilenames({
      city: "杭州",
      targetLayer: "商超点",
      rowCount: 4001,
    })).toEqual([
      "优招-杭州-商超点-第1批.xlsx",
      "优招-杭州-商超点-第2批.xlsx",
      "优招-杭州-商超点-第3批.xlsx",
    ]);
  });

  it("splits each city and layer group without losing or duplicating records", async () => {
    const database = new DatabaseSync(databasePath);
    for (let index = 1; index <= 5; index += 1) {
      insertYouzhaoMarker(database, {
        sourceId: `job-${String(index).padStart(4, "0")}`,
        city: "杭州",
        businessLine: "盒马",
        siteName: `Synthetic Site ${index}`,
        address: `Synthetic Road ${index}`,
      });
    }
    database.close();

    const result = await exportYouzhaoDingmapTemplates({ city: "杭州", outputDir, batchSize: 2 });

    expect(result.totalRows).toBe(5);
    expect(result.groups).toEqual([
      {
        targetLayer: "商超点",
        rowCount: 5,
        files: [
          "优招-杭州-商超点-第1批.xlsx",
          "优招-杭州-商超点-第2批.xlsx",
          "优招-杭州-商超点-第3批.xlsx",
        ],
      },
    ]);
    await expect(readSheetRows(join(outputDir, "优招-杭州-商超点-第1批.xlsx"))).resolves.toMatchObject({
      rows: expect.arrayContaining([expect.objectContaining({ 标记名称: "Synthetic Site 1" })]),
    });
    expect((await readSheetRows(join(outputDir, "优招-杭州-商超点-第1批.xlsx"))).rows).toHaveLength(2);
    expect((await readSheetRows(join(outputDir, "优招-杭州-商超点-第2批.xlsx"))).rows).toHaveLength(2);
    expect((await readSheetRows(join(outputDir, "优招-杭州-商超点-第3批.xlsx"))).rows).toHaveLength(1);
  });

  it("validates city and sanitizes unsafe filename characters", async () => {
    await expect(exportYouzhaoDingmapTemplates({ city: "", outputDir })).rejects.toThrow(
      "必须选择一个城市",
    );
    await expect(exportYouzhaoDingmapTemplates({ city: "杭州,上海", outputDir })).rejects.toThrow(
      "一次只能导出一个城市",
    );

    const database = new DatabaseSync(databasePath);
    insertYouzhaoMarker(database, {
      sourceId: "job-safe-name",
      city: "杭/州:*?",
      businessLine: "美团",
      siteName: "Synthetic Safe Site",
      address: "Synthetic Safe Road",
    });
    database.close();

    const result = await exportYouzhaoDingmapTemplates({ city: "杭/州:*?", outputDir });

    expect(result.groups[0]?.files[0]).toBe("优招-杭_州___-美团点.xlsx");
    expect(result.groups[0]?.files[0]).not.toMatch(/[\\/:*?"<>|]/);
  });
});

function insertYouzhaoMarker(
  database: DatabaseSync,
  input: {
    sourceId: string;
    city: string;
    businessLine: string;
    siteName: string;
    address: string;
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
      input.siteName,
      input.address,
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
      input.siteName,
      input.address,
      JSON.stringify({
        raw: {
          city: input.city,
          businessLine: input.businessLine,
          业务线: input.businessLine,
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
