import { HonoRequest } from "hono";

const libdnfUserAgent = /^libdnf \((.+); (.+); (.+)\.(.+)\)$/;

export const postEvent = async (req: HonoRequest) => {
  // Plausible doesn't handle query params outside of a few whitelisted ones, they recommend doing this
  const repo = req.query("repo");
  const countme = req.query("countme");

  const libdnfMatch = req.header("user-agent")?.match(libdnfUserAgent);

  const event = {
    domain: "tetsudou.fyralabs.com",
    name: "pageview",
    props: {
      distro: libdnfMatch?.[1],
      variant: libdnfMatch?.[2],
      os: libdnfMatch?.[3],
      arch: libdnfMatch?.[4],
      repo,
      countme,
    },
    url: req.url,
  };

  await fetch("https://plausible.fyralabs.com/api/event", {
    method: "POST",
    body: JSON.stringify(event),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": req.header("User-Agent")!,
      "X-Forwarded-For": req.header("Cf-Connecting-Ip")!,
    },
  });
};
