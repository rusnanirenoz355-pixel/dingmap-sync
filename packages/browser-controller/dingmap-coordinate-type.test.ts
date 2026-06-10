import { describe, expect, it } from "vitest";
import { isDingmapMarsCoordinateText } from "./dingmap-upload";

describe("DingMap coordinate type matching", () => {
  it("accepts the exact Mars coordinate label", () => {
    expect(isDingmapMarsCoordinateText("\u706b\u661f\u5750\u6807\uff08\u9ad8\u5fb7/\u817e\u8baf/\u8c37\u6b4c\uff09")).toBe(
      true,
    );
  });

  it("accepts minor text differences", () => {
    expect(isDingmapMarsCoordinateText("\u706b\u661f\u5750\u6807")).toBe(true);
    expect(isDingmapMarsCoordinateText("\u706b\u661f\u5750\u6807 (\u9ad8\u5fb7/\u817e\u8baf/\u8c37\u6b4c)")).toBe(true);
    expect(isDingmapMarsCoordinateText("\u9ad8\u5fb7 / \u817e\u8baf / \u8c37\u6b4c")).toBe(true);
  });

  it("rejects non-Mars coordinate labels", () => {
    expect(isDingmapMarsCoordinateText("\u767e\u5ea6\u5750\u6807")).toBe(false);
    expect(isDingmapMarsCoordinateText("WGS84")).toBe(false);
  });
});
