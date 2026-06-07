import { describe, expect, it } from "vitest";
import { resolveFieldAlias } from "./field-aliases";

describe("field aliases", () => {
  it("resolves Chinese aliases to normalized field names", () => {
    expect(resolveFieldAlias("站点名称")).toBe("site_name");
    expect(resolveFieldAlias("联系人")).toBe("station_manager");
    expect(resolveFieldAlias("面试时间")).toBe("interview_time");
    expect(resolveFieldAlias("职位")).toBe("job_title");
  });

  it("ignores spaces and punctuation in headers", () => {
    expect(resolveFieldAlias(" 联系电话： ")).toBe("phone");
  });
});
