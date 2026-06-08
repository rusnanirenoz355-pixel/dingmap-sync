import { describe, expect, it } from "vitest";
import {
  buildDingmapExportFilename,
  buildDingmapOneClickWorkbook,
} from "./one-click-export";

describe("dingmap one click export", () => {
  it("builds a workbook with the real DingMap template headers", () => {
    const workbook = buildDingmapOneClickWorkbook([
      {
        source: "manual_paste",
        siteName: "测试站点",
        address: "测试地址",
        stationManager: "张三",
        phone: "测试号码",
        originType: "manual_paste",
        syncAction: "create",
        syncStatus: "pending",
      },
    ]);
    const worksheet = workbook.getWorksheet("Sheet1");

    expect(worksheet?.getRow(1).values).toEqual([
      undefined,
      "标记名称",
      "详细地址",
      "经度",
      "纬度",
      "备注",
      "字段一",
      "字段二",
    ]);
    expect(worksheet?.getRow(2).getCell(1).value).toBe("测试站点");
    expect(worksheet?.getRow(2).getCell(6).value).toBe("张三测试号码");
  });

  it("generates timestamped xlsx filenames", () => {
    expect(buildDingmapExportFilename(new Date("2026-06-08T09:30:00+08:00"))).toMatch(
      /^dingmap-import-\d{8}-\d{6}\.xlsx$/,
    );
  });
});

