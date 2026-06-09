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
    expect(worksheet?.getRow(2).getCell(6).value).toBe("张三 测试号码");
  });

  it("generates short Chinese xlsx filenames", () => {
    expect(
      buildDingmapExportFilename(new Date("2026-06-09T17:31:00+08:00"), {
        platformLabel: "美团点",
        exportName: "苏州黑闸",
      }),
    ).toBe("美团点-苏州黑闸-6.9-17.31.xlsx");
  });

  it("uses unnamed when the custom export name is blank", () => {
    expect(
      buildDingmapExportFilename(new Date("2026-06-09T17:31:00+08:00"), {
        platformLabel: "美团点",
        exportName: "  ",
      }),
    ).toBe("美团点-未命名-6.9-17.31.xlsx");
  });

  it("sanitizes unsafe export filename segments", () => {
    expect(
      buildDingmapExportFilename(new Date("2026-06-09T14:25:30+08:00"), {
        platformLabel: "美团点",
        exportName: '..\\余杭/第一批:*?"<>|  测试',
      }),
    ).toBe("美团点-余杭-第一批-测试-6.9-14.25.xlsx");
  });
});

