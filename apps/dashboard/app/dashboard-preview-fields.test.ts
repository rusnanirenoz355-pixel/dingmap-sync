import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard import preview fields", () => {
  const pageSource = readFileSync(join(process.cwd(), "apps", "dashboard", "app", "page.tsx"), "utf8");
  const previewSource = sliceFunction(pageSource, "function PreviewTable", "function CleanMarkerTable");

  it("renders the accepted preview column labels in order", () => {
    const labels = Array.from(previewSource.matchAll(/\{ label: "([^"]+)"/g), (match) => match[1]);

    expect(labels).toEqual([
      "行号",
      "来源",
      "站点名称",
      "站点地址",
      "联系人",
      "薪资待遇",
      "福利待遇",
      "交付条件",
      "原始文本",
      "状态",
      "错误 / 警告",
    ]);
  });

  it("merges contact and phone without rendering a separate phone column", () => {
    expect(previewSource).toContain("formatPreviewContact(row.mapped.stationManager, row.mapped.phone)");
    expect(previewSource).not.toContain('{ label: "电话"');
    expect(previewSource).not.toContain('popoverTitle="电话" value={row.mapped.phone}');
  });
});

function sliceFunction(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}
