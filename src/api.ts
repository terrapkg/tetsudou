// Authenticated API for controlling and querying Tetsudou

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { RepomdInfo } from "./types/tetsudou";
import { bearerAuth } from "hono/bearer-auth";
import { env } from "cloudflare:workers";

const api = new Hono<{ Bindings: Env }>();
api.use(bearerAuth({ token: env.API_KEY }));

// This route can be called even if repo is not registered
api.post("/repos/:repo/refresh", async (c) => {
  const repo = c.req.param("repo");

  const response = await fetch(
    `https://repos.fyralabs.com/${repo}/repodata/tetsudou.json`,
  );
  if (!response.ok) {
    throw new HTTPException(500, { message: "Failed to fetch metadata" });
  }
  const tetsudouMetadata = (await response.json()) as RepomdInfo;

  await c.env.TETSUDOU.put(
    `metadata/${repo}`,
    JSON.stringify(tetsudouMetadata),
  );

  return c.status(204);
});

api.delete("/repos/:repo", async (c) => {
  const repo = c.req.param("repo");

  await c.env.TETSUDOU.delete(`metadata/${repo}`);

  return c.status(204);
});

export default api;
