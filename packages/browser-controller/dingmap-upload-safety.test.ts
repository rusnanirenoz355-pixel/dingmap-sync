import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dingmap upload browser safety", () => {
  const source = readFileSync(
    join(process.cwd(), "packages", "browser-controller", "dingmap-upload.ts"),
    "utf8",
  );

  it("uses the automation Chrome channel for the persistent DingMap browser", () => {
    expect(source).toContain('channel: "chrome"');
    expect(source).toContain("launchPersistentContext");
  });

  it("does not close the automation browser from upload result paths", () => {
    expect(source).not.toContain("await session.close()");
    expect(source).not.toContain("await context.close()");
    expect(source).not.toContain("await page.close()");
  });
});
