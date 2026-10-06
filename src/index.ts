import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { type } from "arktype";
import { Mirror } from "./types/tetsudou";
import { Document, Hash, MFile, Resources } from "./types/metalink";
import { activeAlternates, getRepoMetadata } from "./metadata";
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

    const mirrors = await c.env.TETSUDOU.get("mirrors");

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

    const metadata = await getRepoMetadata(repo, c.env);
    if (metadata === null) {
      throw new HTTPException(404, {
        message: "No metadata found for this repo",
      });
    }

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

    const toHashes = (hashes: Record<string, string>): Hash[] =>
      Object.entries(hashes).map(([type, value]) => ({
        _attributes: {
          type,
        },
        _text: value,
      }));

    const alternates = activeAlternates(metadata, Date.now());

    const file: MFile = {
      _attributes: {
        name: "repomd.xml",
      },
      "mm0:timestamp": metadata.timestamp,
      size: metadata.size,
      verification: { hash: toHashes(metadata.hashes) },
      ...(alternates.length > 0 && {
        "mm0:alternates": {
          "mm0:alternate": alternates.map((alternate) => ({
            "mm0:timestamp": alternate.timestamp,
            size: alternate.size,
            verification: { hash: toHashes(alternate.hashes) },
          })),
        },
      }),
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

    return c.body(xml.js2xml(document, { compact: true }), 200, {
      "Content-Type": "application/metalink+xml",
    });
  },
);

export default {
  fetch: app.fetch,
};
