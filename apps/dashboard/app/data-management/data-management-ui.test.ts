import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("data management table scrolling UI", () => {
  const source = readFileSync(
    join(process.cwd(), "apps", "dashboard", "app", "data-management", "page.tsx"),
    "utf8",
  );

  it("keeps the management table inside a bounded two-axis scroll frame", () => {
    [
      "function TableScrollFrame",
      "min-w-0",
      "max-h-[520px]",
      "overflow-x-auto",
      "overflow-y-auto",
      "sticky top-0",
      "z-10",
      "bg-tableHead",
      "bg-white",
    ].forEach((contract) => {
      expect(source).toContain(contract);
    });
  });
});
