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
      salary: "薪资说明",
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
    expect(row["备注"]).toBe("薪资说明");
    expect(row["字段一"]).toBe("联系人：张三；电话：测试号码");
    expect(row["字段二"]).toBe("人工备注");
  });

  it("leaves field two blank when remark is blank instead of falling back to interview time", () => {
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

    expect(row["字段二"]).toBe("");
  });

  it("formats field one without undefined, null, or placeholders", () => {
    const contactOnly = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      siteName: "测试站点",
      address: "测试地址",
      stationManager: "李四",
      phone: "",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });
    const phoneOnly = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      siteName: "测试站点",
      address: "测试地址",
      stationManager: "",
      phone: "测试号码",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });
    const blank = mapCleanMarkerToDingmapImportRow({
      source: "manual_paste",
      siteName: "测试站点",
      address: "测试地址",
      originType: "manual_paste",
      syncAction: "create",
      syncStatus: "pending",
    });

    expect(contactOnly["字段一"]).toBe("联系人：李四");
    expect(phoneOnly["字段一"]).toBe("电话：测试号码");
    expect(blank["字段一"]).toBe("");
  });
});

