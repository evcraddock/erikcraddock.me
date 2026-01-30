import { describe, it, expect } from "bun:test";
import { API_KEY_PREFIX, isValidApiKeyFormat, generateApiKey } from "../api-key-utils";

describe("API_KEY_PREFIX", () => {
  it("has expected value", () => {
    expect(API_KEY_PREFIX).toBe("ek_");
  });
});

describe("isValidApiKeyFormat", () => {
  it("returns true for valid key format", () => {
    const validKey = "ek_" + "a".repeat(64);
    expect(isValidApiKeyFormat(validKey)).toBe(true);
  });

  it("returns false for wrong prefix", () => {
    const invalidKey = "wrong_" + "a".repeat(64);
    expect(isValidApiKeyFormat(invalidKey)).toBe(false);
  });

  it("returns false for too short key", () => {
    const shortKey = "ek_" + "a".repeat(32);
    expect(isValidApiKeyFormat(shortKey)).toBe(false);
  });

  it("returns false for too long key", () => {
    const longKey = "ek_" + "a".repeat(128);
    expect(isValidApiKeyFormat(longKey)).toBe(false);
  });

  it("returns false for non-hex characters", () => {
    const invalidKey = "ek_" + "g".repeat(64);
    expect(isValidApiKeyFormat(invalidKey)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidApiKeyFormat("")).toBe(false);
  });
});

describe("generateApiKey", () => {
  it("generates key with correct prefix", async () => {
    const { key } = await generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it("generates key with correct format", async () => {
    const { key } = await generateApiKey();
    expect(isValidApiKeyFormat(key)).toBe(true);
  });

  it("generates 64-char hash", async () => {
    const { keyHash } = await generateApiKey();
    expect(keyHash).toHaveLength(64);
  });

  it("generates unique keys", async () => {
    const key1 = await generateApiKey();
    const key2 = await generateApiKey();

    expect(key1.key).not.toBe(key2.key);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });
});
