import {
  AlternateRepomdInfo,
  RepoMetadata,
  RepomdInfo,
} from "./types/tetsudou";

// Subatomic keeps metadata files for an hour after they stop being referenced by repomd.xml,
// so alternates must expire before that or clients would be sent to files which no longer exist
export const ALTERNATE_TTL = 50 * 60 * 1000;

export const getRepoMetadata = async (
  repo: string,
  env: Env,
): Promise<RepoMetadata | null> => {
  const stored = await env.TETSUDOU.get(`metadata/${repo}`);
  return stored === null ? null : (JSON.parse(stored) as RepoMetadata);
};

export const activeAlternates = (
  { alternates = [] }: RepoMetadata,
  now: number,
): AlternateRepomdInfo[] =>
  alternates.filter(
    (alternate) => now - alternate.replacedAt < ALTERNATE_TTL,
  );

export const updateRepomd = async (
  repo: string,
  env: Env,
  current: RepomdInfo,
): Promise<void> => {
  const now = Date.now();
  const previous = await getRepoMetadata(repo, env);

  let alternates: AlternateRepomdInfo[] = [];
  if (previous !== null) {
    alternates = activeAlternates(previous, now);
    if (previous.hashes.sha256 !== current.hashes.sha256) {
      const { alternates: _, ...previousInfo } = previous;
      alternates.unshift({ ...previousInfo, replacedAt: now });
    }
    // The current repomd.xml shouldn't also be listed as an alternate
    alternates = alternates.filter(
      (alternate) => alternate.hashes.sha256 !== current.hashes.sha256,
    );
  }

  const metadata: RepoMetadata = { ...current, alternates };
  await env.TETSUDOU.put(`metadata/${repo}`, JSON.stringify(metadata));
};
