import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { federation as fedifyMiddleware } from "@fedify/hono";
import { pages } from "./routes/pages";
import { feed } from "./routes/feed";
import { auth } from "./routes/auth";
import { admin } from "./routes/admin";
import { api } from "./routes/api";
import { mediaRoute } from "./routes/media";
import { federation } from "./federation/setup";
import { logger } from "./utils/logger";

const app = new Hono();

// Fedify middleware - handles ActivityPub requests
// Must be before other routes so it can intercept AP requests via content negotiation
app.use(
  "*",
  fedifyMiddleware(federation, () => undefined)
);

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

export default {
  port,
  fetch: app.fetch,
};
