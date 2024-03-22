# Tetsudou

Tetsudou is a metalink generator and is going to be used by Terra and the
Ultramarine Repository. The end. That's all it has.

## Why you shouldn't use Tetsudou

Tetsudou is probably not your favourite way to generate metalinks because

- it uses [Cloudflare KV] which is overly low-latency
- it's too simple to be configured with JSON
- it's written in ~200 lines of code meaning it's too lightweight
- it's deployed using Cloudflare Workers with overkilled reliability

## Configuration

### Metalink

Store the data for all repos in KV pairs in the namespace `TETSUDOU_REPOS`, where the keys are repo
ids used in `?repo=`, while the values are just arrays of mirror data specified in JSON like below:

```json
[
  {
    "url": "repos.fyralabs.com/terra39/",
    "asn": 24940,
    "continent": "EU",
    "country": "DE",
    "lat": 50.4779,
    "lon": 12.3713,
    "arch": "x86_64",
    "protocols": ["http", "https"]
  },
  ...
]
```

### Mirrorlist

Store the data for each repos in `tetsudou.json` files inside their own `repodata` directories (e.g.
`https://repos.fyralabs.com/terra39/repodata/tetsudou.json`), with the data describing `repomd.xml`:

```json
{
  "timestamp": 1136977871,
  "size": 111,
  "hashes": {
    "md5": "698d51a19d8a121ce581499d7b701668",
    "sha1": "6216f8a75fd5bb3d5f22b6f9958cdede3fc086c2",
    "sha256": "...",
    "sha512": "..."
  }
}
```

## Naming

The name Tetsudou follows the J-Pop convention again (I hope you saw it coming) --- except it comes
with a twist as it's named after
<ruby>[なんとか鉄道の夕]<rt>nantoka tetsudou no yuu</rt></ruby> (Somehow an evening on the railway)
by Umicha. Is this really J-Pop? Anyway, this <ruby>界隈<rt>kaiwai</rt></ruby> song talks about Aoi
(who is blind) and Akane (who is deaf) having a ride in a train. Maybe this is yet another fun
comeback to some people writing Python code that takes 10 hours to run for output used by millions?

And notice the song title has 11 syllables which is the same as[^1]
<ruby>[クロマグロがとんでくる]<rt>kuromaguro ga tondekuru</rt></ruby>(A bluefin tuna comes flying).
I guess that kinda means we are also following the food convention?

[^1]:
    This is related because 1. they are both 界隈(kaiwai) songs; 2. their artist both has made
    another song with a 15-syllable title:
    [クモヒトデのうまる砂の上で], [イワシがつちからはえてくるんだ].
    Also, my favourite tuna cover: https://youtu.be/aZcXDexWeKs

[Cloudflare KV]: https://developers.cloudflare.com/kv/learning/how-kv-works/
[なんとか鉄道の夕]: https://youtu.be/FfqFKR23K7M
[クモヒトデのうまる砂の上で]: https://youtu.be/dPQRX8V0QvQ
[クロマグロがとんでくる]: https://youtu.be/ceyr4ezheOg
[イワシがつちからはえてくるんだ]: https://youtu.be/dr1_LWqSoeY
