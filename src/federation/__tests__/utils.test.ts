import { describe, it, expect } from "bun:test";
import { dateToInstant, baseUrl, getProtocol, getOrigin } from "../utils";
import { Temporal } from "@js-temporal/polyfill";

describe("Federation Utils", () => {
  describe("getProtocol", () => {
    it("returns http for localhost", () => {
      expect(getProtocol("localhost")).toBe("http");
      expect(getProtocol("localhost:5000")).toBe("http");
      expect(getProtocol("localhost:3000")).toBe("http");
    });

    it("returns https for production domains", () => {
      expect(getProtocol("erikcraddock.me")).toBe("https");
      expect(getProtocol("example.com")).toBe("https");
      expect(getProtocol("subdomain.example.com")).toBe("https");
    });

    it("returns http for local network hosts", () => {
      expect(getProtocol("127.0.0.1")).toBe("http");
      expect(getProtocol("10.10.1.197:5000")).toBe("http");
      expect(getProtocol("192.168.1.20")).toBe("http");
      expect(getProtocol("172.16.0.5")).toBe("http");
      expect(getProtocol("devbox.local:5000")).toBe("http");
    });

    it("returns https for domains containing localhost as substring", () => {
      expect(getProtocol("mylocalhost.com")).toBe("https");
    });
  });

  describe("getOrigin", () => {
    it("returns http://localhost for localhost domains", () => {
      expect(getOrigin("localhost")).toBe("http://localhost");
      expect(getOrigin("localhost:5000")).toBe("http://localhost:5000");
    });

    it("returns https:// for production domains", () => {
      expect(getOrigin("erikcraddock.me")).toBe("https://erikcraddock.me");
      expect(getOrigin("example.com")).toBe("https://example.com");
    });

    it("returns http:// for LAN IPs", () => {
      expect(getOrigin("10.10.1.197:5000")).toBe("http://10.10.1.197:5000");
    });
  });

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
