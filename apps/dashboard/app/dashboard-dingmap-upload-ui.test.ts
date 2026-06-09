import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard DingMap upload UI", () => {
  const source = readFileSync(join(process.cwd(), "apps", "dashboard", "app", "page.tsx"), "utf8");

  it("opens DingMap through the automation browser API instead of a normal link", () => {
    expect(source).toContain("handleDingmapOpen");
    expect(source).toContain('/api/dingmap/open');
    expect(source).not.toContain('href="https://dm.dingmap.com/home"');
    expect(source).not.toContain('target="_blank"');
  });

  it("offers manual assisted positioning and continue controls", () => {
    expect(source).toContain("人工辅助定位");
    expect(source).toContain("manualAssist");
    expect(source).toContain("await startDingmapUpload(true);");
    expect(source).toContain("manual_assist");
    expect(source).toContain("继续");
  });

  it("maps internal stages to concise Chinese labels", () => {
    expect(source).toContain("uploadStageLabels");
    expect(source).toContain('"set-coordinate-type": "正在选择坐标类型"');
    expect(source).toContain('manual_assist: "等待人工辅助"');
    expect(source).toContain("formatUploadStage");
    expect(source).not.toContain('value={job.stage ?? job.status}');
  });
});
