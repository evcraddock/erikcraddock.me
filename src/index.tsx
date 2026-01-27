import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { Layout } from "./templates/layout";

const app = new Hono();

// Serve static files from public/
app.use("/css/*", serveStatic({ root: "./public" }));

app.get("/", (c) => {
  return c.html(
    <Layout title="Home | erikcraddock.me">
      <h1 class="text-3xl font-bold mb-4">Welcome</h1>
      <p class="text-gray-600">Coming soon.</p>
    </Layout>
  );
});

// ActivityPub actor endpoint (placeholder)
app.get("/.well-known/webfinger", (c) => {
  return c.json({ message: "WebFinger endpoint - to be implemented" });
});

const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};
