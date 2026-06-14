import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("youzhao Dashboard preview UI", () => {
  const source = readFileSync(join(process.cwd(), "apps", "dashboard", "app", "page.tsx"), "utf8");

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
      "当前城市",
      "生成文件",
      "下载",
      "/api/youzhao/export",
    ].forEach((text) => {
      expect(source).toContain(text);
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
});
