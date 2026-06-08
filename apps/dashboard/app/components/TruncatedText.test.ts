import { describe, expect, it } from "vitest";
import { summarizeText } from "./TruncatedText";

describe("summarizeText", () => {
  it("keeps short text unchanged", () => {
    expect(summarizeText("Short value", 50)).toEqual({
      summary: "Short value",
      isTruncated: false,
    });
  });

  it("trims and truncates long text without returning the full value", () => {
    const value = "Synthetic long remark ".repeat(10);
    const result = summarizeText(value, 50);

    expect(result.isTruncated).toBe(true);
    expect(result.summary.length).toBeLessThanOrEqual(53);
    expect(result.summary).toContain("...");
    expect(result.summary).not.toBe(value);
  });
});
