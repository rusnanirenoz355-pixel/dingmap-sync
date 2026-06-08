import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  MAX_EXCEL_DATA_ROWS,
  MAX_EXCEL_UPLOAD_BYTES,
  parseExcelImportWorkbook,
} from "./parser";

const syntheticPhone = ["199", "0000", "0000"].join("");

async function workbookBuffer(
  build: (workbook: ExcelJS.Workbook) => void | Promise<void>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await build(workbook);
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

describe("excel import parser", () => {
  it("parses the first worksheet by default and maps headers", async () => {
    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("First");
      sheet.addRow(["站点名称", "地址", "电话", "联系人", "未知列"]);
      sheet.addRow(["Excel Site", "Excel Road", syntheticPhone, "Manager E", "Keep me"]);
    });

    const result = await parseExcelImportWorkbook(buffer);

    expect(result.sheetNames).toEqual(["First"]);
    expect(result.selectedSheetName).toBe("First");
    expect(result.rawRows).toHaveLength(1);
    expect(result.rows[0]?.mapped).toMatchObject({
      source: "excel",
      originType: "excel",
      siteName: "Excel Site",
      address: "Excel Road",
      phone: syntheticPhone,
      stationManager: "Manager E",
    });
    expect(result.rows[0]?.raw["未知列"]).toBe("Keep me");
    expect(result.summary.valid).toBe(1);
  });

  it("parses a selected worksheet without merging sheets", async () => {
    const buffer = await workbookBuffer((workbook) => {
      const first = workbook.addWorksheet("First");
      first.addRow(["站点名称", "地址"]);
      first.addRow(["First Site", "First Road"]);
      const second = workbook.addWorksheet("Second");
      second.addRow(["站点名称", "地址"]);
      second.addRow(["Second Site", "Second Road"]);
    });

    const result = await parseExcelImportWorkbook(buffer, { sheetName: "Second" });

    expect(result.sheetNames).toEqual(["First", "Second"]);
    expect(result.selectedSheetName).toBe("Second");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.mapped.siteName).toBe("Second Site");
  });

  it("skips fully empty rows", async () => {
    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("First");
      sheet.addRow(["站点名称", "地址"]);
      sheet.addRow([]);
      sheet.addRow(["Excel Site", "Excel Road"]);
    });

    const result = await parseExcelImportWorkbook(buffer);

    expect(result.rawRows).toHaveLength(1);
    expect(result.rawRows[0]?.rowIndex).toBe(3);
  });

  it("rejects files larger than the upload limit before parsing", async () => {
    await expect(parseExcelImportWorkbook(Buffer.alloc(MAX_EXCEL_UPLOAD_BYTES + 1))).rejects.toThrow(
      "5 MB",
    );
  });

  it("rejects worksheets with more than the row limit", async () => {
    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("First");
      sheet.addRow(["站点名称", "地址"]);
      for (let index = 0; index < MAX_EXCEL_DATA_ROWS + 1; index += 1) {
        sheet.addRow([`Excel Site ${index}`, `Excel Road ${index}`]);
      }
    });

    await expect(parseExcelImportWorkbook(buffer)).rejects.toThrow("1000");
  });

  it("rejects missing selected worksheets and empty headers", async () => {
    const buffer = await workbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("First");
      sheet.addRow([]);
      sheet.addRow(["Excel Site", "Excel Road"]);
    });

    await expect(parseExcelImportWorkbook(buffer, { sheetName: "Missing" })).rejects.toThrow(
      "worksheet",
    );
    await expect(parseExcelImportWorkbook(buffer)).rejects.toThrow("headers");
  });
});
