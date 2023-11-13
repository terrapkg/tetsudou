use serde::Serialize;

#[derive(serde::Deserialize, Clone, Debug)]
pub struct Mirror {
    pub url: String,
    pub arch: String,
    pub country: String,
    pub protocols: Vec<String>,
}

// hashmap of repo-id and Mirror
pub type Repos = std::collections::HashMap<String, Vec<Mirror>>;

#[derive(Serialize, Clone)]
pub struct Metalink<'a> {
    #[serde(rename = "@version")]
    pub version: &'a str, // 3.0?
    #[serde(rename = "@xmlns")]
    pub xmlns: &'a str, // = "http://www.metalinker.org/"
    #[serde(rename = "@type")]
    pub rtype: &'a str, // dynamic
    #[serde(rename = "@pubdate")]
    pub pubdate: String, // %a, %b %d %Y %T %Z
    #[serde(rename = "@generator")]
    pub generator: &'a str,
    #[serde(rename = "@mm0")]
    pub attrmm0: &'a str,
    pub files: Files<'a>,
}

#[derive(Serialize, Clone)]
pub struct Files<'a> {
    #[serde(rename = "file")]
    pub files: [File<'a>; 1],
}

#[derive(Serialize, Clone)]
pub struct File<'a> {
    #[serde(rename = "@name")]
    pub name: &'a str,
    pub timestamp: u64,
    pub size: usize,
    pub verification: Verification,
    pub resources: Resources<'a>,
}

#[derive(Serialize, Clone)]
pub struct Verification {
    #[serde(rename = "hash")]
    pub hashes: Vec<Hash>,
}

#[derive(Serialize, serde::Deserialize, Clone)]
pub struct Hash {
    #[serde(rename = "@type")]
    pub kind: String,
    #[serde(rename = "$value")]
    pub hash: String,
}

#[derive(Serialize, Clone)]
pub struct Resources<'a> {
    #[serde(rename = "@maxconnections")]
    pub maxconnections: usize,
    #[serde(rename = "url")]
    pub urls: Vec<Url<'a>>,
}

#[derive(Serialize, Clone)]
pub struct Url<'a> {
    #[serde(rename = "@protocol")]
    pub protocol: &'a str,
    #[serde(rename = "@type")]
    pub rtype: &'a str,
    #[serde(rename = "location")]
    pub location: &'a str,
    #[serde(rename = "preference")]
    pub preference: usize,
    #[serde(rename = "$value")]
    pub link: String,
}

#[derive(serde::Deserialize, Clone)]
pub struct RepomdInfo {
    pub timestamp: u64,
    pub size: usize,
    pub hashes: std::collections::HashMap<String, String>,
}
