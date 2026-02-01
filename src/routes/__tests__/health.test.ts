import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { health } from "../health";

const app = new Hono();
app.route("/", health);

describe("GET /health", () => {
  it("returns 200 OK", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });

  it("returns JSON with status ok", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("returns version string", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(typeof body.version).toBe("string");
    expect(body.version).not.toBe("");
  });

  it("returns ISO 8601 timestamp", async () => {
    const res = await app.request("/health");
    const body = await res.json();
    expect(typeof body.timestamp).toBe("string");
    // Verify it's a valid ISO date
    const date = new Date(body.timestamp);
    expect(date.toISOString()).toBe(body.timestamp);
  });

  it("returns correct content-type", async () => {
    const res = await app.request("/health");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
