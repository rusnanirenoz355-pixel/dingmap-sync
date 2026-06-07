import { describe, expect, it } from "vitest";
import { buildDingmapDescription } from "../packages/dingmap/build-description";
import { buildMarkerHash } from "../packages/normalizer/build-marker-hash";
import { normalizePhone } from "../packages/normalizer/normalize-phone";
import { normalizeText } from "../packages/normalizer/normalize-text";

describe("normalizer foundation", () => {
  it("normalizes whitespace and phone-like text", () => {
    expect(normalizeText("  A   B  ")).toBe("A B");
    expect(normalizePhone(" 123-456  ")).toBe("123456");
  });

  it("builds stable marker hashes", () => {
    const marker = {
      siteName: "示例站点",
      address: "示例地址",
      source: "manual_paste",
      originType: "manual_paste" as const,
      syncAction: "review" as const,
      syncStatus: "need_confirm" as const,
    };

    expect(buildMarkerHash(marker)).toBe(buildMarkerHash(marker));
  });

  it("builds dingmap description sections", () => {
    const description = buildDingmapDescription({
      source: "manual_paste",
      remark: "人工备注占位",
    });

    expect(description).toContain("【系统同步信息】");
    expect(description).toContain("【人工备注】");
  });
});
