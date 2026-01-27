import { Hono } from "hono";
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

export default {
  port,
  fetch: app.fetch,
};
