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
  const inspectSource = readFileSync(
    join(process.cwd(), "packages", "browser-controller", "dingmap-inspect.ts"),
    "utf8",
  );

  it("delegates import dialog options to the dedicated controller", () => {
    expect(uploadSource).toContain("DingMapImportDialogController");
    expect(uploadSource).toContain("const importDialog = new DingMapImportDialogController");
    expect(uploadSource.indexOf("await setImportOptions")).toBeLessThan(
      uploadSource.indexOf("await importDialog.uploadFile"),
    );
    expect(uploadSource.indexOf("await importDialog.uploadFile")).toBeLessThan(
      uploadSource.indexOf("await importDialog.clickImport"),
    );
    expect(uploadSource.indexOf("await importDialog.clickImport")).toBeLessThan(
      uploadSource.indexOf("await importDialog.readResult"),
    );
  });

  it("waits for the DingMap result from the import click time, not the job start time", () => {
    expect(uploadSource).toContain("const resultStartedAt = Date.now()");
    expect(uploadSource).toContain("await importDialog.readResult(resultStartedAt)");
    expect(uploadSource).not.toContain("await importDialog.readResult(startedAt)");
  });

  it("keeps the DingMap inspect helper noninteractive and self-cleaning when requested", () => {
    expect(inspectSource).toContain("--capture-now");
    expect(inspectSource).toContain("/user/login");
    expect(inspectSource).toContain("session.context.close()");
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
