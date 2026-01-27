import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { pages } from "./routes/pages";
import { logger } from "./utils/logger";

const app = new Hono();

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
app.use("/css/*", serveStatic({ root: "./public" }));

// Mount routes
app.route("/", pages);

// ActivityPub actor endpoint (placeholder)
app.get("/.well-known/webfinger", (c) => {
  return c.json({ message: "WebFinger endpoint - to be implemented" });
});

const port = Number(process.env.PORT) || 3000;

logger.info("server", `Starting on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
