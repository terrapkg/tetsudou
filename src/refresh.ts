import { RepomdInfo } from "./types/tetsudou";
import { HTTPException } from "hono/http-exception";

const RETRY_ATTEMPTS = 3;
const ATTEMPT_DELAY_BASE = 1000;
const ATTEMPT_DELAY_MULTIPLIER = 2;

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
      console.error(`error requesting ${repo}. attempt #${i+1}`)
      console.error(error)
      const delay = ATTEMPT_DELAY_BASE * ATTEMPT_DELAY_MULTIPLIER ** i
      await new Promise((resolve, _) => setTimeout(resolve, delay))
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
