import { describe, it, expect } from "bun:test";
import { parseArgs } from "../index";

describe("parseArgs", () => {
  it("returns empty command and options for no args", () => {
    const result = parseArgs([]);
    expect(result.command).toEqual([]);
    expect(result.options).toEqual({});
  });

  it("parses simple command", () => {
    const result = parseArgs(["login"]);
    expect(result.command).toEqual(["login"]);
    expect(result.options).toEqual({});
  });

  it("parses command with subcommand", () => {
    const result = parseArgs(["config", "show"]);
    expect(result.command).toEqual(["config", "show"]);
  });

  it("parses --verbose flag", () => {
    const result = parseArgs(["--verbose", "login"]);
    expect(result.options.verbose).toBe(true);
    expect(result.command).toEqual(["login"]);
  });

  it("parses -v shorthand", () => {
    const result = parseArgs(["-v", "login"]);
    expect(result.options.verbose).toBe(true);
  });

  it("parses --json flag", () => {
    const result = parseArgs(["post", "list", "--json"]);
    expect(result.options.json).toBe(true);
    expect(result.command).toEqual(["post", "list"]);
  });

  it("parses --config with space separator", () => {
    const result = parseArgs(["--config", "./dev-config.yaml", "post", "list"]);
    expect(result.options.configPath).toBe("./dev-config.yaml");
    expect(result.command).toEqual(["post", "list"]);
  });

  it("parses --config with equals separator", () => {
    const result = parseArgs(["--config=/path/to/config.yaml", "login"]);
    expect(result.options.configPath).toBe("/path/to/config.yaml");
  });

  it("parses --api-url with space separator", () => {
    const result = parseArgs(["--api-url", "https://example.com/api", "login"]);
    expect(result.options.apiUrl).toBe("https://example.com/api");
    expect(result.command).toEqual(["login"]);
  });

  it("parses --api-url with equals separator", () => {
    const result = parseArgs(["--api-url=https://example.com/api", "login"]);
    expect(result.options.apiUrl).toBe("https://example.com/api");
  });

  it("parses --api-key with space separator", () => {
    const result = parseArgs(["--api-key", "ek_secret123", "login"]);
    expect(result.options.apiKey).toBe("ek_secret123");
  });

  it("parses --api-key with equals separator", () => {
    const result = parseArgs(["--api-key=ek_secret123", "login"]);
    expect(result.options.apiKey).toBe("ek_secret123");
  });

  it("parses --help flag", () => {
    const result = parseArgs(["login", "--help"]);
    expect(result.options.help).toBe(true);
    expect(result.command).toEqual(["login"]);
  });

  it("parses -h shorthand", () => {
    const result = parseArgs(["config", "-h"]);
    expect(result.options.help).toBe(true);
  });

  it("parses multiple flags together", () => {
    const result = parseArgs([
      "--verbose",
      "--api-url=https://example.com/api",
      "--api-key",
      "ek_key",
      "--json",
      "post",
      "list",
    ]);
    expect(result.options.verbose).toBe(true);
    expect(result.options.json).toBe(true);
    expect(result.options.apiUrl).toBe("https://example.com/api");
    expect(result.options.apiKey).toBe("ek_key");
    expect(result.command).toEqual(["post", "list"]);
  });

  it("handles flags after command", () => {
    const result = parseArgs(["login", "--verbose", "--api-url", "https://test.com"]);
    expect(result.options.verbose).toBe(true);
    expect(result.options.apiUrl).toBe("https://test.com");
    expect(result.command).toEqual(["login"]);
  });

  it("passes unknown flags to command", () => {
    const result = parseArgs(["post", "create", "--title", "Hello"]);
    expect(result.command).toEqual(["post", "create", "--title", "Hello"]);
  });

  it("handles --api-url without value (edge case)", () => {
    const result = parseArgs(["--api-url"]);
    // When --api-url is last, args[i+1] is undefined, so apiUrl won't be set
    expect(result.options.apiUrl).toBeUndefined();
  });
});
