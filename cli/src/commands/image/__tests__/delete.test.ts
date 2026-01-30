import { describe, it, expect } from "bun:test";
import { parseDeleteArgs } from "../delete";

describe("parseDeleteArgs", () => {
  it("parses numeric id as first non-flag argument", () => {
    const result = parseDeleteArgs(["42"]);
    expect(result.id).toBe(42);
    expect(result.help).toBe(false);
  });

  it("parses --yes flag", () => {
    const result = parseDeleteArgs(["42", "--yes"]);
    expect(result.id).toBe(42);
    expect(result.options.yes).toBe(true);
  });

  it("parses -y shorthand", () => {
    const result = parseDeleteArgs(["42", "-y"]);
    expect(result.id).toBe(42);
    expect(result.options.yes).toBe(true);
  });

  it("parses --help flag", () => {
    const result = parseDeleteArgs(["--help"]);
    expect(result.help).toBe(true);
  });

  it("parses -h shorthand", () => {
    const result = parseDeleteArgs(["-h"]);
    expect(result.help).toBe(true);
  });

  it("returns null id when no id provided", () => {
    const result = parseDeleteArgs(["--yes"]);
    expect(result.id).toBeNull();
  });

  it("ignores non-numeric strings as id", () => {
    const result = parseDeleteArgs(["abc"]);
    expect(result.id).toBeNull();
  });

  it("parses id before flags", () => {
    const result = parseDeleteArgs(["--yes", "42"]);
    expect(result.id).toBe(42);
    expect(result.options.yes).toBe(true);
  });

  it("handles multiple flags", () => {
    const result = parseDeleteArgs(["42", "--yes", "--help"]);
    expect(result.id).toBe(42);
    expect(result.options.yes).toBe(true);
    expect(result.help).toBe(true);
  });
});
