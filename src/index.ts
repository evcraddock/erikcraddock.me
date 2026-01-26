import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello from erikcraddock.me!");
});

// ActivityPub actor endpoint (placeholder)
app.get("/.well-known/webfinger", (c) => {
  return c.json({ message: "WebFinger endpoint - to be implemented" });
});

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
