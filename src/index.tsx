import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { Layout } from "./templates/layout";

const app = new Hono();

app.get("/", (c) => {
  return c.html(
    <Layout title="Home | erikcraddock.me">
      <h1>Welcome</h1>
      <p>Coming soon.</p>
    </Layout>
  );
});

// ActivityPub actor endpoint (placeholder)
app.get("/.well-known/webfinger", (c) => {
  return c.json({ message: "WebFinger endpoint - to be implemented" });
});

const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});

export default app;
