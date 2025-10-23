export type Mirror = {
  url: string;
  repos: string[];
  arch?: string; // some repos are noarch or anyarch (packages from all arches in one repo)
  asn: number;
  continent: string;
  lat: number;
  lon: number;
  country: string;
  protocols: string[];
};

export type MirrorWithPreference = Mirror & {
  preference: number;
};

export type RepomdInfo = {
  timestamp: number;
  size: number;
  hashes: Record<string, string>;
};
