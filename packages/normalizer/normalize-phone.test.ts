import { describe, expect, it } from "vitest";
import { normalizePhone, normalizePhoneForImport } from "./normalize-phone";

describe("normalize phone", () => {
  it("keeps the basic digit-only normalizer stable", () => {
    expect(normalizePhone(" 123-456 ")).toBe("123456");
  });

  it("extracts mainland mobile numbers for import", () => {
    const result = normalizePhoneForImport("199-0000-0000");

    expect(result.primaryPhone).toBe("19900000000");
    expect(result.isValid).toBe(true);
  });

  it("reports invalid phone-like text", () => {
    const result = normalizePhoneForImport("12345");

    expect(result.isValid).toBe(false);
    expect(result.primaryPhone).toBe("");
  });
});
