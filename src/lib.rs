mod mirrors;
use itertools::Itertools;
use mirrors::{Mirror, Repos};
use worker::*;

macro_rules! bail {
    ($left:pat = $right:expr => $code:literal $err:expr) => {
        let $left = $right else {
            console_debug!("Bail({}): {}", $code, $err);
            return Response::error($err, $code);
        };
    };
}

lazy_static::lazy_static! {
    static ref REPOS: std::sync::RwLock<Repos> = std::sync::RwLock::new(Repos::new());
}

async fn init_repo(ctx: &RouteContext<()>, repo: &str) -> Option<Vec<Mirror>> {
    let repos = ctx.kv("TETSUDOU_REPOS").ok()?;
    let Ok(Some(mirrors)) = (repos.get(repo).json::<Vec<Mirror>>().await)
        .map_err(|e| console_error!(" :: E: No TETSUDOU_REPOS `{repo}`: {e:?}"))
    else {
        console_error!(" :: E: No TETSUDOU_REPOS `{repo}`");
        return None;
    };
    REPOS.write().unwrap().insert(repo.into(), mirrors.clone());
    Some(mirrors)
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
    ($req:ident, $ctx:ident, $mirrors:ident, $filter:ident, $repo:ident) => {
        bail!(Some((($repo, arch), cntry)) = get_queries(&$req.url()?) => 400 "`repo=` or `arch=` not specified.");
        let $filter = |m: &&Mirror| m.arch == arch && cntry.as_ref().map_or(true, |ct| &m.country == ct);
        let guard = REPOS.read().unwrap();
        let (mut mirrors, mut _bindmirrors) = (guard.get(&$repo), None);
        if mirrors.is_none() {
            drop(guard); // init_repo() needs .write()
            _bindmirrors = init_repo(&$ctx, &$repo).await;
            mirrors = _bindmirrors.as_ref();
        }
        bail!(Some($mirrors) = mirrors => 400 "Unknown `repo=` specified");
    }
}

async fn mirrorlist(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    get_mirrors!(req, ctx, mirrors, filter, repo);
    let infos = ctx.kv("TETSUDOU_REPOMD_INFO")?;
    bail!(Some(mirrors::RepomdInfo { timestamp, size, hashes }) = infos.get(&repo).json().await?
        => 500 "Can't get repo information"
    );
    let resources = mirrors::Resources {
        maxconnections: 1,
        urls: (mirrors.iter().filter(filter))
            .flat_map(|m| {
                let url = std::path::Path::new(&m.url).join("repodata/repomd.xml");
                (m.protocols.iter()).map(move |rtype| mirrors::Url {
                    protocol: rtype,
                    rtype,
                    location: &m.country,
                    preference: 100,
                    link: format!("{rtype}://{}", url.display()),
                })
            })
            .collect(),
    };
    let hashes = (hashes.into_iter()).map(|(kind, hash)| mirrors::Hash { kind, hash });
    let hashes = hashes.collect();
    let files = mirrors::Files {
        files: [mirrors::File {
            name: "repomd.xml",
            timestamp,
            size,
            verification: mirrors::Verification { hashes },
            resources,
        }],
    };
    let metalink = mirrors::Metalink {
        version: "3.0",
        xmlns: "http://www.metalinker.org/",
        rtype: "dynamic",
        pubdate: (chrono::offset::Local::now().format("%a, %b %d %Y %T %Z")).to_string(),
        generator: "tetsudou",
        attrmm0: "https://github.com/terrapkg/tetsudou",
        files,
    };
    Response::ok(quick_xml::se::to_string(&metalink).map_err(|e| e.to_string())?)
}

async fn metalink(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    get_mirrors!(req, ctx, mirrors, filter, repo);
    let mapper = |m: &Mirror| (m.protocols.iter().map(|p| format!("{p}://{}", m.url))).join("\n");
    let mut list = mirrors.iter().filter(filter).map(mapper);
    Response::ok(list.join("\n"))
}

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    Router::new()
        .get_async("/metalink", metalink)
        .get_async("/mirrorlist", mirrorlist)
        .run(req, env)
        .await
}
