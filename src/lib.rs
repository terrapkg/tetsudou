mod mirrors;
use itertools::Itertools;
use mirrors::Mirror;
use worker::*;

type Res = std::result::Result<String, (u16, String)>;
static mut CACHE: Option<std::collections::HashMap<String, (String, u64)>> = None;
macro_rules! generate_fn {
    ($name:ident($($param:ident),+) => $behind:ident($($args:expr),+) $num:literal) => {
        async fn $name(req: Request, ctx: RouteContext<()>) -> Result<Response> {
            get_mirrors!(req, ctx, repo, $($param),+);
            unsafe {
                let q = req.url().unwrap_unchecked();
                let q = q.query().unwrap_unchecked();
                let id = format!("{}{repo} {q}", stringify!($num));
                let Some((res, _)) = (CACHE.as_ref().unwrap_unchecked())
                    .get(&id)
                    .filter(|(_, t)| time() - t < 300)
                else {
                    return match $behind(&repo, $($args),+).await {
                        Ok(x) => {
                            (CACHE.as_mut().unwrap_unchecked()).insert(id, (x.clone(), time()));
                            Response::ok(x)
                        }
                        Err((i, s)) => Response::error(s, i),
                    };
                };
                Response::ok(res)
            }
        }
    }
}
fn time() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
async fn get_repos(ctx: &RouteContext<()>, repo: &str) -> Option<Vec<Mirror>> {
    let repos = ctx.kv("TETSUDOU_REPOS").ok()?;
    match repos.get(repo).json::<Vec<Mirror>>().await {
        Err(e) => console_error!(" :: E: No TETSUDOU_REPOS `{repo}`: {e:?}"),
        Ok(None) => console_error!(" :: E: No TETSUDOU_REPOS `{repo}`"),
        Ok(mirrors) => return mirrors,
    }
    None
}
fn get_queries(url: &Url) -> Option<((String, String), Option<String>)> {
    let (repo, arch, cntry) = (url.query_pairs()) // FIXME: `path=`?
        .map(|(k, v)| (k.to_string(), Some(v.to_string())))
        .fold((None, None, None), |(r, a, c), (k, v)| match &*k {
            "repo" => (v, a, c),
            "arch" => (r, v, c),
            "country" => (r, a, v),
            _ => (r, a, c),
        });
    Some((repo.zip(arch)?, cntry))
}

macro_rules! get_mirrors {
    ($req:ident, $ctx:ident, $repo:ident, $mirrors:ident, $filter:ident) => {
        let Some((($repo, arch), cntry)) = get_queries(&$req.url().unwrap()) else {
            return Response::error("`repo=` or `arch=` not specified.", 400);
        };
        let $filter =
            |m: &&Mirror| m.arch == arch && cntry.as_ref().map_or(true, |ct| &m.country == ct);
        let Some($mirrors) = (get_repos(&$ctx, &$repo).await) else {
            return Response::error("Unknown `repo=` specified", 400);
        };
    };
}

async fn _metalink(repo: &str, mirrors: Vec<Mirror>, filter: impl Fn(&&Mirror) -> bool) -> Res {
    let req = reqwest::get(format!(
        "https://repos.fyralabs.com/{repo}/repodata/tetsudou.json"
    ))
    .await
    .map_err(|e| console_error!("Can't get tetsudou.json: {e:?}"))
    .map_err(|()| (500, "Bad cfg on main repo".into()))?;
    let mirrors::RepomdInfo {
        timestamp,
        size,
        hashes,
    } = (req.json().await)
        .map_err(|e| console_error!("Can't parse tetsudou.json: {e:?}"))
        .map_err(|()| (500, "Bad cfg on main repo".into()))?;
    let resources = mirrors::Resources {
        maxconnections: 1, // NOTE: idk why either but copied from Fedora
        urls: (mirrors.iter().filter(filter))
            .flat_map(|m| {
                let url = std::path::Path::new(&m.url).join("repodata/repomd.xml");
                (m.protocols.iter()).map(move |rtype| mirrors::Url {
                    protocol: rtype,
                    rtype,
                    location: &m.country,
                    preference: 100, // NOTE: probably can have manual tweaking...?
                    link: format!("{rtype}://{}", url.display()),
                })
            })
            .collect(),
    };
    let hashes = (hashes.into_iter()).map(|(kind, hash)| mirrors::Hash { kind, hash });
    let hashes = hashes.collect();
    let file = mirrors::File {
        name: "repomd.xml",
        timestamp,
        size,
        verification: mirrors::Verification { hashes },
        resources,
    };
    Ok(format!(
        r#"<?xml version="1.0" encoding="utf-8"?><metalink version="3.0" xmlns="http://www.metalinker.org/" type="dynamic" pubdate="{}" generator="mirrormanager" xmlns:mm0="https://github.com/terrapkg/tetsudou"><files>{}</files></metalink>"#,
        chrono::offset::Local::now().format("%a, %b %d %Y %T %Z"),
        quick_xml::se::to_string(&file).map_err(|e| (500, e.to_string()))?
    ))
}
generate_fn!(metalink(mirrors, filter) => _metalink(mirrors, filter) 0);

async fn _mirrorlist(_: &str, mirrors: Vec<Mirror>, filter: impl Fn(&&Mirror) -> bool) -> Res {
    let mapper = |m: &Mirror| (m.protocols.iter().map(|p| format!("{p}://{}", m.url))).join("\n");
    let mut list = mirrors.iter().filter(filter).map(mapper);
    Ok(list.join("\n"))
}
generate_fn!(mirrorlist(mirrors, filter) => _mirrorlist(mirrors, filter) 1);

#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    unsafe { CACHE = Some(std::collections::HashMap::new()) };
    Router::new()
        .get_async("/mirrorlist", mirrorlist)
        .get_async("/metalink", metalink)
        .run(req, env)
        .await
}
