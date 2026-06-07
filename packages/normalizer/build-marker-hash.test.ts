import { describe, expect, it } from "vitest";
import { buildMarkerHash } from "./build-marker-hash";

describe("build marker hash", () => {
  it("changes when hash fields change", () => {
    const base = buildMarkerHash({
      siteName: "测试站点",
      address: "测试地址",
      phone: "19900000000",
    });
    const changed = buildMarkerHash({
      siteName: "测试站点",
      address: "测试地址",
      phone: "19900000001",
    });

    expect(base).not.toBe(changed);
  });
});
