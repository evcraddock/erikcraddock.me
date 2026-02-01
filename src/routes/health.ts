import { Hono } from "hono";
import { readFileSync } from "fs";
import { join } from "path";

// Read version from package.json at startup
let version = "unknown";
try {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
  version = packageJson.version || "unknown";
} catch {
  // Fallback if package.json can't be read
}

const health = new Hono();

/**
 * Public health check endpoint.
 * Returns app status, version, and current timestamp.
 */
health.get("/health", (c) => {
  return c.json({
    status: "ok",
    version,
    timestamp: new Date().toISOString(),
  });
});

export { health };
