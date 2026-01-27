import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";

// We need to test the logger functions, but they depend on process.env
// So we'll test the exported helper functions and mock console.log

describe("logger", () => {
  const originalEnv = process.env;
  const originalStdoutIsTTY = process.stdout.isTTY;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleLogSpy: MockInstance<any[], any>;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    process.stdout.isTTY = originalStdoutIsTTY;
    consoleLogSpy.mockRestore();
  });

  describe("shouldLog", () => {
    it("logs info when LOG_LEVEL is info", async () => {
      process.env.LOG_LEVEL = "info";
      const { shouldLog } = await import("../logger");
      expect(shouldLog("info")).toBe(true);
      expect(shouldLog("warn")).toBe(true);
      expect(shouldLog("error")).toBe(true);
      expect(shouldLog("debug")).toBe(false);
    });

    it("logs all levels when LOG_LEVEL is debug", async () => {
      process.env.LOG_LEVEL = "debug";
      const { shouldLog } = await import("../logger");
      expect(shouldLog("debug")).toBe(true);
      expect(shouldLog("info")).toBe(true);
      expect(shouldLog("warn")).toBe(true);
      expect(shouldLog("error")).toBe(true);
    });

    it("only logs error when LOG_LEVEL is error", async () => {
      process.env.LOG_LEVEL = "error";
      const { shouldLog } = await import("../logger");
      expect(shouldLog("debug")).toBe(false);
      expect(shouldLog("info")).toBe(false);
      expect(shouldLog("warn")).toBe(false);
      expect(shouldLog("error")).toBe(true);
    });

    it("defaults to info when LOG_LEVEL is not set", async () => {
      delete process.env.LOG_LEVEL;
      const { shouldLog } = await import("../logger");
      expect(shouldLog("debug")).toBe(false);
      expect(shouldLog("info")).toBe(true);
    });

    it("defaults to info when LOG_LEVEL is invalid", async () => {
      process.env.LOG_LEVEL = "invalid";
      const { shouldLog } = await import("../logger");
      expect(shouldLog("debug")).toBe(false);
      expect(shouldLog("info")).toBe(true);
    });
  });

  describe("formatTimestamp", () => {
    it("returns timestamp in HH:mm:ss.SSS format", async () => {
      const { formatTimestamp } = await import("../logger");
      const timestamp = formatTimestamp();
      // Match format like "12:34:56.789"
      expect(timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    });
  });

  describe("formatData", () => {
    it("returns empty string for undefined data", async () => {
      const { formatData } = await import("../logger");
      expect(formatData(undefined)).toBe("");
    });

    it("returns empty string for empty object", async () => {
      const { formatData } = await import("../logger");
      expect(formatData({})).toBe("");
    });

    it("returns JSON string with leading space for data", async () => {
      const { formatData } = await import("../logger");
      expect(formatData({ status: 200 })).toBe(' {"status":200}');
    });

    it("handles nested objects", async () => {
      const { formatData } = await import("../logger");
      const result = formatData({ user: { id: 1, name: "test" } });
      expect(result).toBe(' {"user":{"id":1,"name":"test"}}');
    });
  });

  describe("logger methods", () => {
    it("logs info messages when level permits", async () => {
      process.env.LOG_LEVEL = "info";
      process.stdout.isTTY = false; // Use plain output for easier testing
      const { logger } = await import("../logger");

      logger.info("request", "GET /test", { status: 200 });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain("INFO");
      expect(logOutput).toContain("request");
      expect(logOutput).toContain("GET /test");
      expect(logOutput).toContain('"status":200');
    });

    it("does not log debug messages when level is info", async () => {
      process.env.LOG_LEVEL = "info";
      const { logger } = await import("../logger");

      logger.debug("db", "SELECT query");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("logs debug messages when level is debug", async () => {
      process.env.LOG_LEVEL = "debug";
      process.stdout.isTTY = false;
      const { logger } = await import("../logger");

      logger.debug("db", "SELECT query", { rows: 5 });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain("DEBUG");
      expect(logOutput).toContain("db");
      expect(logOutput).toContain("SELECT query");
    });

    it("logs error messages with data", async () => {
      process.env.LOG_LEVEL = "info";
      process.stdout.isTTY = false;
      const { logger } = await import("../logger");

      logger.error("auth", "Token expired", { userId: 123 });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain("ERROR");
      expect(logOutput).toContain("auth");
      expect(logOutput).toContain("Token expired");
      expect(logOutput).toContain('"userId":123');
    });

    it("logs warn messages", async () => {
      process.env.LOG_LEVEL = "warn";
      process.stdout.isTTY = false;
      const { logger } = await import("../logger");

      logger.warn("config", "Missing optional setting");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain("WARN");
      expect(logOutput).toContain("config");
    });
  });
});
