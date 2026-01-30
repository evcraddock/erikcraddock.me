import { describe, it, expect } from "bun:test";
import { rewriteUrlForProxy, isHttps } from "../proxy";

describe("proxy utilities", () => {
  describe("rewriteUrlForProxy", () => {
    it("rewrites http to https when forwarded proto is https", () => {
      const result = rewriteUrlForProxy(
        "http://localhost:5000/users/erik",
        "https",
        "erikcraddock.me"
      );
      expect(result).toBe("https://erikcraddock.me/users/erik");
    });

    it("preserves path and query string", () => {
      const result = rewriteUrlForProxy(
        "http://localhost:5000/users/erik/outbox?cursor=0",
        "https",
        "erikcraddock.me"
      );
      expect(result).toBe("https://erikcraddock.me/users/erik/outbox?cursor=0");
    });

    it("returns original URL when forwardedProto is not https", () => {
      const original = "http://localhost:5000/users/erik";
      expect(rewriteUrlForProxy(original, "http", "localhost")).toBe(original);
      expect(rewriteUrlForProxy(original, undefined, "localhost")).toBe(original);
    });

    it("returns original URL when forwardedHost is missing", () => {
      const original = "http://localhost:5000/users/erik";
      expect(rewriteUrlForProxy(original, "https", undefined)).toBe(original);
      expect(rewriteUrlForProxy(original, "https", "")).toBe(original);
    });

    it("returns original URL when already https", () => {
      const original = "https://erikcraddock.me/users/erik";
      expect(rewriteUrlForProxy(original, "https", "erikcraddock.me")).toBe(original);
    });

    it("handles URLs with non-default ports in forwarded host", () => {
      const result = rewriteUrlForProxy(
        "http://localhost:5000/users/erik",
        "https",
        "erikcraddock.me:8443"
      );
      expect(result).toBe("https://erikcraddock.me:8443/users/erik");
    });

    it("strips default port 443 for https", () => {
      // URL class automatically removes default ports
      const result = rewriteUrlForProxy(
        "http://localhost:5000/users/erik",
        "https",
        "erikcraddock.me:443"
      );
      expect(result).toBe("https://erikcraddock.me/users/erik");
    });
  });

  describe("isHttps", () => {
    it("returns true for https URLs", () => {
      expect(isHttps("https://erikcraddock.me")).toBe(true);
      expect(isHttps("https://erikcraddock.me/users/erik")).toBe(true);
    });

    it("returns false for http URLs", () => {
      expect(isHttps("http://localhost:5000")).toBe(false);
      expect(isHttps("http://erikcraddock.me")).toBe(false);
    });
  });
});
