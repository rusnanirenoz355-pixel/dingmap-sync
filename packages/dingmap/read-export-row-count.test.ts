import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it } from "vitest";

import {
  DINGMAP_UPLOAD_MAX_DATA_ROWS,
  assertDingmapUploadRowLimit,
  readDingmapExportDataRowCount,
} from "./read-export-row-count";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("dingmap export row count", () => {
  it("counts data rows without counting the header row", async () => {
    const filePath = await writeWorkbookWithRows(2_000);

    await expect(readDingmapExportDataRowCount(filePath)).resolves.toBe(2_000);
    await expect(assertDingmapUploadRowLimit(filePath)).resolves.toEqual({
      dataRows: 2_000,
      maxRows: DINGMAP_UPLOAD_MAX_DATA_ROWS,
      allowed: true,
    });
  });

  it("blocks exports with more than 2000 data rows", async () => {
    const filePath = await writeWorkbookWithRows(2_001);

    await expect(assertDingmapUploadRowLimit(filePath)).rejects.toMatchObject({
      stage: "row-limit",
      dataRows: 2_001,
      maxRows: DINGMAP_UPLOAD_MAX_DATA_ROWS,
    });
  });
});

async function writeWorkbookWithRows(dataRows: number): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "dingmap-row-count-"));
  tempDirs.push(dir);
  const filePath = join(dir, `dingmap-import-20260609-${String(dataRows).padStart(6, "0")}.xlsx`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(["标记名称", "详细地址", "经度", "纬度", "备注", "字段一", "字段二"]);

  for (let index = 0; index < dataRows; index += 1) {
    sheet.addRow([`测试站点${index + 1}`, "测试地址", "", "", "", "", ""]);
  }

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}
