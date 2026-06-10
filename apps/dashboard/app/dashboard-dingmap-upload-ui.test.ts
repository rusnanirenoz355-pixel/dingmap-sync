import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard DingMap upload UI", () => {
  const source = readFileSync(join(process.cwd(), "apps", "dashboard", "app", "page.tsx"), "utf8");

  it("opens DingMap through the automation browser API instead of a normal link", () => {
    expect(source).toContain("handleDingmapOpen");
    expect(source).toContain("/api/dingmap/open");
    expect(source).not.toContain('href="https://dm.dingmap.com/home"');
    expect(source).not.toContain('target="_blank"');
  });

  it("does not expose manual assisted positioning in the product upload flow", () => {
    expect(source).not.toContain("人工辅助定位");
    expect(source).not.toContain("manualAssist");
    expect(source).not.toContain("manual_assist");
    expect(source).not.toContain("assistSnapshot");
  });

  it("offers login continuation and upload reset controls", () => {
    expect(source).toContain("handleDingmapUploadContinue");
    expect(source).toContain("handleDingmapUploadReset");
    expect(source).toContain("/api/dingmap/upload/reset");
    expect(source).toContain("重置上传任务");
  });

  it("maps internal stages to concise Chinese labels", () => {
    expect(source).toContain("uploadStageLabels");
    expect(source).toContain('"set-coordinate-type"');
    expect(source).toContain('"browser-closed"');
    expect(source).toContain("formatUploadStage");
    expect(source).toContain("formatUploadMessage");
  });

  it("separates target import options from page-confirmed values", () => {
    expect(source).toContain("\u76ee\u6807\u6807\u8bb0\u5927\u5c0f");
    expect(source).toContain("\u9875\u9762\u786e\u8ba4\u6807\u8bb0\u5927\u5c0f");
    expect(source).toContain("confirmedMarkerSize ??");
    expect(source).not.toContain("\u5f53\u524d\u6807\u8bb0\u5927\u5c0f");
  });
});
