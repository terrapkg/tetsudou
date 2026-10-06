// Authenticated API for controlling and querying Tetsudou

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { env } from "cloudflare:workers";
import { updateRepomd } from "./metadata";
import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";

const api = new Hono<{ Bindings: Env }>();
api.use(bearerAuth({ token: env.API_KEY }));

const repomdInfo = type({
  timestamp: "number",
  size: "number",
  hashes: { "[string]": "string" },
});

api.post(
  "/repos/:repo",
  arktypeValidator("json", repomdInfo, (result, c) => {
    if (!result.success) {
      return c.json({ success: false, errors: result.errors.summary }, 400);
    }
  }),
  async (c) => {
    const repo = c.req.param("repo");

    await updateRepomd(repo, c.env, c.req.valid("json"));

    return c.body(null, 204);
  },
);

api.delete("/repos/:repo", async (c) => {
  const repo = c.req.param("repo");

  await c.env.TETSUDOU.delete(`metadata/${repo}`);

  return c.body(null, 204);
});

export default api;
