import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { pages } from "./routes/pages";

const app = new Hono();

// Serve static files from public/
app.use("/css/*", serveStatic({ root: "./public" }));

// Mount routes
app.route("/", pages);

// ActivityPub actor endpoint (placeholder)
app.get("/.well-known/webfinger", (c) => {
  return c.json({ message: "WebFinger endpoint - to be implemented" });
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
