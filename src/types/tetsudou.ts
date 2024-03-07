export type Mirror = {
  url: string;
  arch?: string; // some repos are noarch or anyarch (packages from all arches in one repo)
  country: string;
  protocols: string[];
};

export type RepomdInfo = {
  timestamp: number;
  size: number;
  hashes: Record<string, string>;
};
