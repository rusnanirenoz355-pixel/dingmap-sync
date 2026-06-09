import { describe, expect, it } from "vitest";

import {
  STICKY_TABLE_HEAD_CLASS,
  TABLE_SCROLL_FRAME_CLASS,
} from "./TableScrollFrame";

describe("table scroll frame styles", () => {
  it("keeps dense tables inside a bounded two-axis scroll area", () => {
    expect(TABLE_SCROLL_FRAME_CLASS).toContain("max-h-[420px]");
    expect(TABLE_SCROLL_FRAME_CLASS).toContain("overflow-x-auto");
    expect(TABLE_SCROLL_FRAME_CLASS).toContain("overflow-y-auto");
  });

  it("keeps table headers visible while rows scroll", () => {
    expect(STICKY_TABLE_HEAD_CLASS).toContain("sticky");
    expect(STICKY_TABLE_HEAD_CLASS).toContain("top-0");
    expect(STICKY_TABLE_HEAD_CLASS).toContain("z-10");
    expect(STICKY_TABLE_HEAD_CLASS).toContain("bg-tableHead");
  });
});
