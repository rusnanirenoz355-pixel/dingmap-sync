import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("data management table scrolling UI", () => {
  const source = readFileSync(
    join(process.cwd(), "apps", "dashboard", "app", "data-management", "page.tsx"),
    "utf8",
  );
  const drawerSource = readFileSync(
    join(process.cwd(), "apps", "dashboard", "app", "components", "ManagementDrawer.tsx"),
    "utf8",
  );
  const scrollFrameSource = readFileSync(
    join(process.cwd(), "apps", "dashboard", "app", "components", "TableScrollFrame.tsx"),
    "utf8",
  );

  it("keeps the management table inside a bounded two-axis scroll frame", () => {
    [
      "TableScrollFrame",
      "min-w-0",
      "maxHeightClass=\"max-h-[520px]\"",
      "overflow-x-auto",
      "overflow-y-auto",
      "sticky top-0",
      "z-10",
      "bg-tableHead",
      "bg-white",
    ].forEach((contract) => {
      expect(`${source}\n${scrollFrameSource}`).toContain(contract);
    });
  });

  it("does not expose interview time in the management page or edit drawer", () => {
    expect(source).not.toContain("面试时间");
    expect(drawerSource).not.toContain("面试时间");
    expect(drawerSource).not.toContain("interviewTime");
  });
});
