use serde::Serialize;

#[derive(serde::Deserialize, Clone, Debug)]
pub struct Mirror {
    pub url: String,
    pub arch: String,
    pub country: String,
    pub protocols: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename = "file")]
pub struct File<'a> {
    #[serde(rename = "@name")]
    pub name: &'a str,
    #[serde(rename = "mm0:timestamp")]
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
