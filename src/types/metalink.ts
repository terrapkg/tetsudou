// Type definitions for Metalink XML nodes, represented as compact JS objects

export type Document = {
  _declaration: {
    _attributes: {
      version: "1.0";
      encoding: "utf-8";
    };
  };
  metalink: {
    _attributes: {
      version: "3.0";
      xmlns: "http://www.metalinker.org/";
      "xmlns:mm0": "http://fedorahosted.org/mirrormanager";
      type: "dynamic";
      generator: "tetsudou";
    };
    files: { file: MFile }[];
  };
};

export type MFile = {
  _attributes: {
    name: string;
  };
  "mm0:timestamp": number;
  size: number;
  verification: Verification;
  "mm0:alternates"?: Alternates;
  resources: Resources;
};

// This took me forever to find out this is a thing (not very well documented).
// Mirrormanager has its own extension to list the previous versions of repomd.xml,
// so if you have mirrors or caches that are lagging behind,
// DNF will compare it against the alternates and still succeed.
export type Alternates = {
  "mm0:alternate": Alternate[];
};

export type Alternate = {
  "mm0:timestamp": number;
  size: number;
  verification: Verification;
};

export type Verification = {
  hash: Hash[];
};

export type Hash = {
  _attributes: {
    type: string;
  };
  _text: string;
};

export type Resources = {
  _attributes: {
    maxconnections: number;
  };
  url: Url[];
};

export type Url = {
  _attributes: {
    protocol: string;
    type: string;
    location: string;
    preference: number;
  };
  _text: string;
};
