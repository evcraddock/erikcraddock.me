import { describe, it, expect } from "bun:test";
import { dateToInstant, baseUrl } from "../utils";
import { Temporal } from "@js-temporal/polyfill";

describe("Federation Utils", () => {
  describe("dateToInstant", () => {
    it("converts Date to Temporal.Instant", () => {
      const date = new Date("2025-01-15T10:30:00Z");

      const instant = dateToInstant(date);

      expect(instant).toBeInstanceOf(Temporal.Instant);
      expect(instant.epochMilliseconds).toBe(date.getTime());
    });

    it("preserves millisecond precision", () => {
      const date = new Date("2025-01-15T10:30:00.123Z");

      const instant = dateToInstant(date);

      expect(instant.epochMilliseconds).toBe(date.getTime());
    });
  });

  describe("baseUrl", () => {
    it("is defined", () => {
      expect(baseUrl).toBeDefined();
      expect(typeof baseUrl).toBe("string");
    });

    it("starts with http or https", () => {
      expect(baseUrl).toMatch(/^https?:\/\//);
    });
  });
});
