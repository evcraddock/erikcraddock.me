import { describe, it, expect } from "bun:test";
import { normalizeEmail, isValidEmail, isSelfDelete } from "../email";

describe("normalizeEmail", () => {
  it("converts to lowercase", () => {
    expect(normalizeEmail("User@Test.COM")).toBe("user@test.com");
  });

  it("trims whitespace", () => {
    expect(normalizeEmail("  user@test.com  ")).toBe("user@test.com");
  });

  it("handles both together", () => {
    expect(normalizeEmail("  User@TEST.com  ")).toBe("user@test.com");
  });
});

describe("isValidEmail", () => {
  it("returns true for valid email", () => {
    expect(isValidEmail("user@test.com")).toBe(true);
  });

  it("returns true for email with whitespace (gets normalized)", () => {
    expect(isValidEmail("  user@test.com  ")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("returns false for whitespace only", () => {
    expect(isValidEmail("   ")).toBe(false);
  });

  it("returns false for string without @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });
});

describe("isSelfDelete", () => {
  it("returns true when emails match", () => {
    expect(isSelfDelete("user@test.com", "user@test.com")).toBe(true);
  });

  it("returns true when emails match (case insensitive)", () => {
    expect(isSelfDelete("User@Test.COM", "user@test.com")).toBe(true);
  });

  it("returns true when emails match (with whitespace)", () => {
    expect(isSelfDelete("  user@test.com  ", "user@test.com")).toBe(true);
  });

  it("returns false when emails differ", () => {
    expect(isSelfDelete("other@test.com", "user@test.com")).toBe(false);
  });
});
