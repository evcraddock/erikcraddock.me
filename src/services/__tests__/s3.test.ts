import { describe, it, expect } from "bun:test";
import { generateKey } from "../s3";

describe("generateKey", () => {
  it("generates key with correct format", () => {
    const key = generateKey("photo.jpg");
    // Format: {timestamp}-{random}.{ext}
    expect(key).toMatch(/^\d+-[a-z0-9]+\.jpg$/);
  });

  it("generates unique keys", () => {
    const key1 = generateKey("file.png");
    const key2 = generateKey("file.png");
    expect(key1).not.toBe(key2);
  });

  it("handles filename with multiple dots", () => {
    const key = generateKey("my.file.name.png");
    expect(key).toMatch(/\.png$/);
  });

  it("handles filename without extension", () => {
    const key = generateKey("noextension");
    // When no dot in filename, pop() returns the whole filename
    expect(key).toMatch(/^\d+-[a-z0-9]+\.noextension$/);
  });

  it("handles empty filename", () => {
    const key = generateKey("");
    // Empty string split gives [""], pop returns ""
    expect(key).toMatch(/^\d+-[a-z0-9]+\.$/);
  });

  it("preserves extension case", () => {
    const key = generateKey("image.PNG");
    expect(key).toMatch(/\.PNG$/);
  });
});
