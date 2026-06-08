import { describe, expect, it } from "vitest";
import { normalizePhone, normalizePhoneForImport } from "./normalize-phone";

describe("normalize phone", () => {
  it("keeps the basic digit-only normalizer stable", () => {
    expect(normalizePhone(" 123-456 ")).toBe("123456");
  });

  it("extracts mainland mobile numbers for import", () => {
    const syntheticPhone = ["199", "0000", "0000"].join("");
    const result = normalizePhoneForImport(["199", "0000", "0000"].join("-"));

    expect(result.primaryPhone).toBe(syntheticPhone);
    expect(result.isValid).toBe(true);
  });

  it("reports invalid phone-like text", () => {
    const result = normalizePhoneForImport("12345");

    expect(result.isValid).toBe(false);
    expect(result.primaryPhone).toBe("");
  });
});
