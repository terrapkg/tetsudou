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
  resources: Resources;
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
