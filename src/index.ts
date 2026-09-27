import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { type } from "arktype";
import { RepomdInfo, Mirror } from "./types/tetsudou";
import { Document, Hash, MFile, Resources } from "./types/metalink";
import { refreshRepo } from "./refresh";
import { HTTPException } from "hono/http-exception";
import xml from "xml-js";
import { selectMirrors } from "./utils/selection";
import { postEvent } from "./utils/plausible";
import api from "./api";

const app = new Hono<{ Bindings: Env }>();
app.route("/api", api);

const metalinkParams = type({
  repo: "string",
  arch: "string?",
  country: "string?",
});

app.get("/", (c) => {
  return c.redirect("https://github.com/terrapkg/tetsudou");
});

app.get(
  "/metalink",
  // We hit plausible before cache is checked, we want to always log events
  async (c, next) => {
    c.executionCtx.waitUntil(postEvent(c.req));
    await next();
  },
  arktypeValidator("query", metalinkParams, (result, c) => {
    if (!result.success) {
      return c.json({ success: false, errors: result.errors.summary }, 400);
    }
  }),
  async (c) => {
    const { repo, arch } = c.req.valid("query");

    const mirrors = await c.env.TETSUDOU.get("synced_mirrors");

    if (mirrors === null) {
      throw new HTTPException(404, {
        message: "No mirrors found",
      });
    }

    const mirrorList = (JSON.parse(mirrors) as Mirror[]).filter((config) =>
      config.repos.includes(repo),
    );

    if (mirrorList.length === 0) {
      throw new HTTPException(404, {
        message: "No mirrors found for this repo",
      });
    }

    const archCompatibleMirrors = mirrorList.filter(
      // 1. If the mirror's arch is undefined, we assume it's an anyarch repo, and match it
      // 2. If the mirror's arch is the same as the requested arch, match it
      (mirror) => mirror.arch === undefined || mirror.arch === arch,
    );
    const selectedMirrors = selectMirrors(c.req.raw, archCompatibleMirrors);

    const metadata = await c.env.TETSUDOU.get(`metadata/${repo}`);
    if (metadata === null) {
      throw new HTTPException(404, {
        message: "No metadata found for this repo",
      });
    }
    const tetsudouMetadata = JSON.parse(metadata) as RepomdInfo;

    const resources: Resources = {
      _attributes: {
        maxconnections: 1,
      },
      url: selectedMirrors.flatMap((mirror) =>
        mirror.protocols.map((protocol) => ({
          _attributes: {
            type: protocol,
            protocol: protocol,
            location: mirror.country,
            preference: mirror.preference,
          },
          _text: `${protocol}://${mirror.url.replace("{repo_id}", repo)}/repodata/repomd.xml`,
        })),
      ),
    };

    const hashes: Hash[] = Object.entries(tetsudouMetadata.hashes).map(
      ([type, value]) => ({
        _attributes: {
          type,
        },
        _text: value,
      }),
    );

    const file: MFile = {
      _attributes: {
        name: "repomd.xml",
      },
      "mm0:timestamp": tetsudouMetadata.timestamp,
      size: tetsudouMetadata.size,
      verification: { hash: hashes },
      resources,
    };

    const document: Document = {
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "utf-8",
        },
      },
      metalink: {
        _attributes: {
          version: "3.0",
          xmlns: "http://www.metalinker.org/",
          "xmlns:mm0": "http://fedorahosted.org/mirrormanager",
          type: "dynamic",
          generator: "tetsudou",
        },
        files: [{ file }],
      },
    };

    return c.text(xml.js2xml(document, { compact: true }));
  },
);

async function refreshAllRepos(env: Env) {
  const repos = (await env.TETSUDOU.list({
    prefix: "metadata/"
  })).keys.map(key => key.name.replace("metadata/", ''))

  for (const repo of repos) {
    try {
      await refreshRepo(repo, env);
    } catch (error) {
      console.error(`Failed to refresh ${repo}`, error);
    }
  }
}

async function checkMirrorSync(env: Env) {
  const mirrors = await env.TETSUDOU.get("mirrors");

  if (mirrors === null) {
    throw new HTTPException(404, {
      message: "No mirrors found",
    });
  }

  const mirrorList = JSON.parse(mirrors) as Mirror[];

  const mirrorsSyncState: Record<string, { syncState: Record<string, number>, data: Mirror }> = Object.fromEntries(await Promise.all(mirrorList.map(async mirror => {
    let repoSyncState = await Promise.all(mirror.repos.map(async repo => {
      try {
        const url = `https://${mirror.url.replace("{repo_id}", repo)}/repodata/tetsudou.json`
        const response = await fetch(url);

        //console.log(response)

        if (!response.ok) {
          let response_body;
          try {
            response_body = await response.text()
          } catch (error) {
            response_body = String(error)
          }
          //console.log(response_body)

          throw new Error(response_body)
        }
        const tetsudouMetadata = (await response.json()) as RepomdInfo;
        return [repo, tetsudouMetadata.timestamp]
      } catch (e) {
        console.log("failed metadata grab " + mirror.id + " " + repo)
        // we should possibly log these failures? but tbh im not sure what the best way to do that.
        return [repo, 0]
      }
    }))

    return [
      mirror.id,
      {
        syncState: Object.fromEntries(repoSyncState) as Record<string, number>,
        data: mirror
      }
    ];
  })))

  console.log(mirrorsSyncState)

  const primaryId = mirrorList.find(mirror => mirror.primary)?.id

  if (!primaryId) {
    throw new Error("Could not find primary.")
  }

  const { [primaryId]: primaryData, ...mirrorsWithoutPrimary } = mirrorsSyncState;

  const syncedMirrors: Mirror[] = [primaryData.data];

  for (const mirrorId in mirrorsWithoutPrimary) {
    const { syncState, data } = mirrorsWithoutPrimary[mirrorId]

    data.repos = data.repos.filter(repo => {
      return Math.abs(syncState[repo] - primaryData.syncState[repo]) < 0.1
    })

    if (data.repos.length > 0) {
      syncedMirrors.push(data)
    }
  }

  await env.TETSUDOU.put("synced_mirrors", JSON.stringify(syncedMirrors))
}

const scheduled = async (
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext,
) => {
  switch (controller.cron) {
    case "*/15 * * * *":
      await refreshAllRepos(env)
      break;
    case "*/5 * * * *":
      await checkMirrorSync(env)
      break;
  }
};

export default {
  fetch: app.fetch,
  scheduled,
};
