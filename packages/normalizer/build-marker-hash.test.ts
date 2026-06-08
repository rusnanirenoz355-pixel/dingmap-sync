import { describe, expect, it } from "vitest";
import { buildMarkerHash } from "./build-marker-hash";

describe("build marker hash", () => {
  it("changes when hash fields change", () => {
    const syntheticPhone = ["199", "0000", "0000"].join("");
    const changedSyntheticPhone = ["199", "0000", "0001"].join("");
    const base = buildMarkerHash({
      siteName: "Alpha Site",
      address: "Alpha Road",
      phone: syntheticPhone,
    });
    const changed = buildMarkerHash({
      siteName: "Alpha Site",
      address: "Alpha Road",
      phone: changedSyntheticPhone,
    });

    expect(base).not.toBe(changed);
  });
});
