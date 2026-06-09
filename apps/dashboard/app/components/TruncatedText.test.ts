import { describe, expect, it } from "vitest";
import { createElement } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { summarizeText, TruncatedText } from "./TruncatedText";

(globalThis as { React?: typeof React }).React = React;

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

  it("renders a stable two-line summary with a disclosure button for long text", () => {
    const value = "Synthetic long address ".repeat(8);
    const html = renderToStaticMarkup(
      createElement(TruncatedText, { value, maxLength: 40 }),
    );

    expect(html).toContain("line-clamp-2");
    expect(html).toContain("overflow-hidden");
    expect(html).toContain("展开全文");
    expect(html).not.toContain(value);
  });
});
