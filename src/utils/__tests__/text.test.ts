import { describe, it, expect } from "vitest";
import { truncate } from "../text";

describe("truncate", () => {
  it("returns text unchanged if under maxLength", () => {
    expect(truncate("short text", 100)).toBe("short text");
  });

  it("returns text unchanged if exactly maxLength", () => {
    expect(truncate("12345", 5)).toBe("12345");
  });

  it("truncates at word boundary", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const result = truncate(text, 20);
    // Should cut at "The quick brown fox" (19 chars) not mid-word
    expect(result).toBe("The quick brown fox...");
    expect(result).not.toContain("fox j");
  });

  it("adds ellipsis when truncated", () => {
    const text = "This is a longer piece of text";
    const result = truncate(text, 15);
    expect(result.endsWith("...")).toBe(true);
  });

  it("handles single long word by cutting at maxLength", () => {
    const text = "supercalifragilisticexpialidocious";
    const result = truncate(text, 10);
    expect(result).toBe("supercalif...");
  });

  it("handles text with no spaces", () => {
    const text = "NoSpacesHere";
    const result = truncate(text, 5);
    expect(result).toBe("NoSpa...");
  });

  it("handles empty string", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("handles maxLength of 0", () => {
    expect(truncate("some text", 0)).toBe("...");
  });
});
