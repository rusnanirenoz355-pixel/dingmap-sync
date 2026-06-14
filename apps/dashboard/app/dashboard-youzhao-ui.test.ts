import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("youzhao Dashboard preview UI", () => {
  const source = readFileSync(join(process.cwd(), "apps", "dashboard", "app", "page.tsx"), "utf8");
  const scrollFrameSource = readFileSync(
    join(process.cwd(), "apps", "dashboard", "app", "components", "TableScrollFrame.tsx"),
    "utf8",
  );

  it("shows all Task 007-A2 field confirmation columns", () => {
    [
      "合作站点名称",
      "站点地址",
      "岗位名称",
      "站长姓名",
      "站长电话",
      "薪资方案",
      "新人政策",
      "结算规则",
      "原始业务线",
      "目标钉图图层",
      "sourceId",
      "preview 状态",
    ].forEach((column) => {
      expect(source).toContain(column);
    });
  });

  it("renders a fixed seven-column DingMap preview before import", () => {
    [
      "钉图七列预览",
      "标记名称",
      "详细地址",
      "经度",
      "纬度",
      "备注",
      "字段一",
      "字段二",
    ].forEach((column) => {
      expect(source).toContain(column);
    });
  });

  it("shows the minimal Youzhao DingMap export controls", () => {
    [
      "导出钉图 Excel",
      "导出城市",
      "全部城市",
      "youzhaoExportCities",
      "目标图层",
      "全部图层",
      "生成文件",
      "排除缺城市",
      "下载",
      "/api/youzhao/export",
      "targetLayer",
      "totalExported",
      "missingCityExcluded",
      "downloadUrl",
    ].forEach((text) => {
      expect(source).toContain(text);
    });
    expect(source).not.toContain("exportCityScope");
    expect(source).not.toContain("value=\"current\"");
    expect(source).not.toContain("<option value=\"current\">当前城市</option>");
  });

  it("keeps the Dashboard Clean Table inside a bounded sticky-header scroll frame", () => {
    [
      "TableScrollFrame",
      "max-h-[360px]",
      "md:max-h-[420px]",
      "overflow-x-auto",
      "overflow-y-auto",
      "scrollbarGutter",
      "min-w-0",
      "sticky top-0",
      "z-10",
      "bg-tableHead",
    ].forEach((text) => {
      expect(`${source}\n${scrollFrameSource}`).toContain(text);
    });
  });

  it("shows Task 007-B smoke task controls without enabling automatic full runs", () => {
    [
      "启动 smoke",
      "启动 full",
      "暂停任务",
      "继续任务",
      "取消任务",
      "重启任务",
      "暂停或取消将在当前页处理完成后生效",
      "部分数据导出",
      "/api/youzhao/tasks/start",
      "/api/youzhao/tasks/current",
    ].forEach((text) => {
      expect(source).toContain(text);
    });
  });

  it("requires live probe and explicit confirmation before a Hangzhou full task starts", () => {
    [
      "/api/youzhao/probe",
      "\u5b9e\u65f6\u62db\u8058\u4e2d\u603b\u6570",
      "\u6bcf\u9875\u6570\u91cf\uff1a50",
      "\u9884\u8ba1\u603b\u9875\u6570",
      "\u5f53\u524d\u5df2\u6709 smoke \u6570\u636e\u53ef\u80fd\u5728 full \u4e2d\u8ba1\u4e3a duplicate",
      "update_candidate \u4e0d\u4f1a\u8986\u76d6\u73b0\u6709\u6570\u636e",
      "\u786e\u8ba4\u5e76\u5f00\u59cb\u676d\u5dde\u5b8c\u6574\u91c7\u96c6",
      "confirmedTotal",
      "pageSize: 50",
    ].forEach((text) => {
      expect(source).toContain(text);
    });
  });
});
