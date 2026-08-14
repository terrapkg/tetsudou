// Authenticated API for controlling and querying Tetsudou

import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { env } from "cloudflare:workers";
import { refreshRepo } from "./refresh";

const api = new Hono<{ Bindings: Env }>();
api.use(bearerAuth({ token: env.API_KEY }));

// This route can be called even if repo is not registered
api.post("/repos/:repo/refresh", async (c) => {
  const repo = c.req.param("repo");

  await refreshRepo(repo, c.env)

  return c.body(null, 204);
});

api.delete("/repos/:repo", async (c) => {
  const repo = c.req.param("repo");

  await c.env.TETSUDOU.delete(`metadata/${repo}`);

  return c.body(null, 204);
});

export default api;
