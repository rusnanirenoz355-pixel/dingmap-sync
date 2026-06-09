import { describe, expect, it } from "vitest";
import {
  ASSISTED_UPLOAD_STEPS,
  buildAssistedUploadPrompt,
  getNextAssistedUploadStep,
} from "./dingmap-assisted-locator";

describe("dingmap assisted locator workflow", () => {
  it("keeps the manual assist workflow in the required order", () => {
    expect(ASSISTED_UPLOAD_STEPS).toEqual([
      "confirm-login-map",
      "find-layer",
      "open-layer-menu",
      "open-import-dialog",
      "confirm-add-data-tab",
      "confirm-style",
      "upload-file",
      "click-import",
      "wait-result",
    ]);
  });

  it("advances only after the user continues", () => {
    expect(getNextAssistedUploadStep("confirm-login-map")).toBe("find-layer");
    expect(getNextAssistedUploadStep("open-layer-menu")).toBe("open-import-dialog");
    expect(getNextAssistedUploadStep("wait-result")).toBeNull();
  });

  it("builds Chinese prompts that name the platform, layer, and continue action", () => {
    expect(
      buildAssistedUploadPrompt("open-layer-menu", {
        platformLabel: "美团点",
        layerName: "美团点",
        markerColorLabel: "黄色",
      }),
    ).toContain("请点击“美团点”这一行/卡片里的“更多”");
    expect(
      buildAssistedUploadPrompt("confirm-style", {
        platformLabel: "美团点",
        layerName: "美团点",
        markerColorLabel: "黄色",
      }),
    ).toContain("黄色");
    expect(
      buildAssistedUploadPrompt("find-layer", {
        platformLabel: "美团点",
        layerName: "美团点",
        markerColorLabel: "黄色",
      }),
    ).toContain("点击继续");
  });
});
