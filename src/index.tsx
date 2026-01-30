import { Hono } from "hono";
import type { Context, Next } from "hono";
import { pages } from "./routes/pages";
import { feed } from "./routes/feed";
import { auth } from "./routes/auth";
import { admin } from "./routes/admin";
import { api } from "./routes/api";
import { mediaRoute } from "./routes/media";
import { federation } from "./federation/setup";
import { logger } from "./utils/logger";
import { rewriteUrlForProxy } from "./utils/proxy";
import { configureLogtape } from "./utils/logtape-config";

// Configure logtape to capture Fedify's internal logs
configureLogtape().catch((err) => {
  logger.error("logtape", "Failed to configure logtape", { error: String(err) });
});

// Detect runtime for static file serving
const isBun = typeof globalThis.Bun !== "undefined";

const app = new Hono();

/**
 * Custom Fedify middleware that handles X-Forwarded-Proto header.
 *
 * When running behind a reverse proxy (like Caddy), the request URL
 * comes in as http:// even though the original request was https://.
 * This middleware rewrites the request URL to use the correct protocol
 * before passing it to Fedify.
 */
function createProxyAwareFedifyMiddleware() {
  return async (c: Context, next: Next) => {
    const forwardedProto = c.req.header("x-forwarded-proto");
    const forwardedHost = c.req.header("x-forwarded-host") || c.req.header("host");

    let request = c.req.raw;

    // Rewrite URL if behind a proxy with HTTPS
    const rewrittenUrl = rewriteUrlForProxy(request.url, forwardedProto, forwardedHost);
    if (rewrittenUrl !== request.url) {
      request = new Request(rewrittenUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        // @ts-expect-error - duplex is needed for streaming bodies
        duplex: "half",
      });
    }

    // Call Fedify's fetch directly with the (possibly modified) request
    const response = await federation.fetch(request, {
      contextData: undefined,
      onNotFound: async () => {
        await next();
        return c.res;
      },
      onNotAcceptable: async () => {
        await next();
        if (c.res.status !== 404) return c.res;
        return new Response("Not acceptable", {
          status: 406,
          headers: { "Content-Type": "text/plain", Vary: "Accept" },
        });
      },
    });

    return response;
  };
}

// Fedify middleware - handles ActivityPub requests
// Must be before other routes so it can intercept AP requests via content negotiation
app.use("*", createProxyAwareFedifyMiddleware());

// Request logging middleware
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  // Skip logging for static assets to reduce noise
  if (c.req.path.startsWith("/css/")) {
    return;
  }

  logger.info("request", `${c.req.method} ${c.req.path}`, {
    status: c.res.status,
    duration: `${duration}ms`,
  });
});

// Serve static files from public/
// Use runtime-specific static file middleware
if (isBun) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { serveStatic } = require("hono/bun");
  app.use("/css/*", serveStatic({ root: "./public" }));
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { serveStatic } = require("@hono/node-server/serve-static");
  app.use("/css/*", serveStatic({ root: "./public" }));
}

// Mount routes
app.route("/", pages);
app.route("/", feed);
app.route("/", auth);
app.route("/admin", admin);
app.route("/api", api);
app.route("/media", mediaRoute);

const port = Number(process.env.PORT) || 5000;

logger.info("server", `Starting on http://localhost:${port}`);

// In dev, log helpful info
if (process.env.NODE_ENV !== "production") {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    logger.info("server", `Admin email: ${adminEmail}`);
    logger.info("server", `Login at: http://localhost:${port}/login`);
  } else {
    logger.warn("server", "ADMIN_EMAIL not set - run seed script after setting it in .env");
  }
}

// Start server based on runtime
if (isBun) {
  // Bun uses default export
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).default = {
    port,
    fetch: app.fetch,
  };
} else {
  // Node.js uses @hono/node-server
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { serve } = require("@hono/node-server");
  serve({
    fetch: app.fetch,
    port,
  });
}

// Export for Bun (this is used when running with bun)
export default {
  port,
  fetch: app.fetch,
};
