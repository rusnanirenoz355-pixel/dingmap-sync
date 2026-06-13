import { describe, expect, it } from "vitest";
import {
  DINGMAP_IMPORT_HEADERS,
  mapCleanMarkerToDingmapImportRow,
} from "./export-template";

describe("dingmap export template", () => {
  it("keeps header order aligned with the real DingMap template", () => {
    expect(DINGMAP_IMPORT_HEADERS).toEqual([
      "标记名称",
      "详细地址",
      "经度",
      "纬度",
      "备注",
      "字段一",
      "字段二",
    ]);
  });

  it("maps clean markers to the seven DingMap import fields", () => {
    const row = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      sourceId: "row-1",
      siteName: "测试站点",
      address: "测试地址",
      longitude: 121.5,
      latitude: 31.2,
      stationManager: "张三",
      phone: "测试号码",
      remark: "  人工备注  ",
      interviewTime: "  周一  ",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(row["标记名称"]).toBe("测试站点");
    expect(row["详细地址"]).toBe("测试地址");
    expect(row["经度"]).toBe(121.5);
    expect(row["纬度"]).toBe(31.2);
    expect(row["备注"]).toContain("【系统同步信息】");
    expect(row["备注"]).toContain("【人工备注】");
    expect(row["字段一"]).toBe("张三测试号码");
    expect(row["字段二"]).toBe("人工备注");
  });

  it("uses interview time for field two when remark is blank", () => {
    const row = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      siteName: "测试站点",
      address: "测试地址",
      remark: "   ",
      interviewTime: "  明天上午  ",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(row["字段二"]).toBe("明天上午");
  });

  it("leaves field two blank when remark and interview time are blank", () => {
    const row = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      siteName: "测试站点",
      address: "测试地址",
      remark: "   ",
      interviewTime: "",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(row["字段二"]).toBe("");
  });

  it("maps youzhao clean markers to the fixed DingMap import fields", () => {
    const syntheticPhone = ["199", "0000", "0000"].join("");
    const row = mapCleanMarkerToDingmapImportRow({
      source: "youzhao",
      sourceId: "site-1:job-a",
      siteName: "Synthetic Site",
      address: "Synthetic Road",
      longitude: null,
      latitude: null,
      stationManager: "Manager A",
      phone: syntheticPhone,
      jobTitle: "Synthetic Job",
      salary: "Synthetic salary",
      welfare: "Synthetic welfare",
      remark: "Synthetic settlement",
      originType: "web",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(row).toEqual({
      标记名称: "Synthetic Site",
      详细地址: "Synthetic Road",
      经度: "",
      纬度: "",
      备注: "【岗位名称】\nSynthetic Job\n\n【薪资方案】\nSynthetic salary\n\n【新人政策】\nSynthetic welfare",
      字段一: `Manager A ${syntheticPhone}`,
      字段二: "Synthetic settlement",
    });
  });
});

