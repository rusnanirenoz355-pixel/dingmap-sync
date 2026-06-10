import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMarkerColorSelectors } from "./dingmap-selectors";
import { isDingmapSmallMarkerSizeText } from "./dingmap-upload";

describe("DingMap marker style automation helpers", () => {
  const uploadSource = readFileSync(
    join(process.cwd(), "packages", "browser-controller", "dingmap-upload.ts"),
    "utf8",
  );

  it("sets import dialog options through an explicit ordered flow", () => {
    expect(uploadSource).toContain("async function setImportOptions");
    expect(uploadSource).toContain("async function setCoordinateType");
    expect(uploadSource).toContain("async function setMarkerStyle");
    expect(uploadSource).toContain("async function setMarkerSize");
    expect(uploadSource.indexOf("await setCoordinateType")).toBeLessThan(
      uploadSource.indexOf("await setMarkerStyle"),
    );
    expect(uploadSource.indexOf("await setMarkerStyle")).toBeLessThan(
      uploadSource.indexOf("await setMarkerSize"),
    );
  });

  it("keeps color nth fallbacks scoped to the marker style panel", () => {
    const mianshiSelectors = buildMarkerColorSelectors("\u7ea2\u8272", "red");
    const meituanSelectors = buildMarkerColorSelectors("\u9ec4\u8272", "yellow");

    expect(mianshiSelectors.some((selector) => selector.includes("ant-popover"))).toBe(true);
    expect(mianshiSelectors.some((selector) => selector.includes("color"))).toBe(true);
    expect(mianshiSelectors.at(-1)).toContain("following::*");
    expect(mianshiSelectors.at(-1)).not.toContain("self::button");
    expect(mianshiSelectors.at(-1)).toContain("[3]");
    expect(meituanSelectors.at(-1)).toContain("[6]");
  });

  it("accepts small marker size text variants", () => {
    expect(isDingmapSmallMarkerSizeText("\u5c0f")).toBe(true);
    expect(isDingmapSmallMarkerSizeText("\u5c0f\u53f7")).toBe(true);
    expect(isDingmapSmallMarkerSizeText("small")).toBe(true);
    expect(isDingmapSmallMarkerSizeText("\u6807\u8bb0\u5927\u5c0f\uff1a\u5c0f")).toBe(true);
    expect(isDingmapSmallMarkerSizeText("\u4e2d")).toBe(false);
  });
});
