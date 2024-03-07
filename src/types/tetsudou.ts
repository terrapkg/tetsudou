export type Mirror = {
  url: string;
  arch: string;
  country: string;
  protocols: string[];
};

export type RepomdInfo = {
  timestamp: number;
  size: number;
  hashes: Record<string, string>;
};
