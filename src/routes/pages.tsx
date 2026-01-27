import { Hono } from "hono";
import { Layout } from "../templates/layout";

const pages = new Hono();

pages.get("/", (c) => {
  return c.html(
    <Layout title="Home | erikcraddock.me">
      <h1 class="text-3xl font-bold mb-4">Welcome</h1>
      <p class="text-gray-600">Coming soon.</p>
    </Layout>
  );
});

export { pages };
