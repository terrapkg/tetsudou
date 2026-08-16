import { RepomdInfo } from "./types/tetsudou";
import { HTTPException } from "hono/http-exception";

const RETRY_ATTEMPTS = 3;

export const refreshRepo = async (
  repo: string,
  env: Env,
): Promise<void> => {
  let tetsudouMetadata = undefined;
  for (let i = 0; i < RETRY_ATTEMPTS; i++) {
    try {
      const response = await fetch(
        `https://repos.fyralabs.com/${repo}/repodata/tetsudou.json`,
      );
      if (!response.ok) {
        throw new HTTPException(500, { message: "Failed to fetch metadata" });
      }
      tetsudouMetadata = (await response.json()) as RepomdInfo;
    } catch (error) {
      console.log(`error requesting ${repo}. attempt #${i+1}`)
      console.log(error)
    }
  }

  if (tetsudouMetadata == undefined) {
    throw new HTTPException(500, { message: "Failed to fetch metadata" });
  }

  await env.TETSUDOU.put(
    `metadata/${repo}`,
    JSON.stringify(tetsudouMetadata),
  );
};
