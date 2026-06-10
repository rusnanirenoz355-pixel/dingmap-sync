import { describe, expect, it } from "vitest";
import {
  DINGMAP_BROWSER_CLOSED_MESSAGE,
  formatDingmapUploadErrorMessage,
} from "./dingmap-upload";

describe("DingMap upload error formatting", () => {
  it("hides raw Playwright browser closed errors from users", () => {
    expect(
      formatDingmapUploadErrorMessage(
        new Error("Target page, context or browser has been closed"),
      ),
    ).toBe(DINGMAP_BROWSER_CLOSED_MESSAGE);
  });

  it("keeps non-browser-closed errors unchanged for diagnostics", () => {
    expect(formatDingmapUploadErrorMessage(new Error("upload input not found"))).toBe(
      "upload input not found",
    );
  });
});
