# 2026-10-09 17:19 — `deploy/.env.example`: dokumentáljuk a `GHCR_OWNER` / `IMAGE_TAG` / `REGISTRY` változókat

## Háttér

`./deploy/deploy.sh up dev` WSL alatt `error from registry: denied` hibával
szakadt meg a `compose pull` lépésben. A kiváltó ok az volt, hogy a
[`deploy/.env.dev`](../../deploy/.env.dev) nem definiálta a `GHCR_OWNER`
változót, ezért a base compose [`infra/docker-compose.yml`](../../infra/docker-compose.yml)
a `${GHCR_OWNER:-local}` defaultra esett, és a droplet a nemlétező
`ghcr.io/local/aisztens-…` csomagnevekre próbált pullolni. A
[`docs/milestones/2026-10-09--13-30-00-local-stack-ghcr-owner-guard-fix.milestone.md`](../../milestones/2026-10-09--13-30-00-local-stack-ghcr-owner-guard-fix.milestone.md)
szándékosan lazította a base compose-t `:?` abortról `:-default` formára,
hogy a lokális stack alapértelmezetten működjön — ez a lazítás viszont
azzal a mellékhatással járt, hogy a deploy script nem áll le a hiányzó
`GHCR_OWNER` miatt, hanem csendben rossz image-referenciát ír a droplet
`infra/.env` fájljába.

A hibaelemzés során kiderült, hogy a [`deploy/.env.example`](../../deploy/.env.example)
sablon **egyáltalán nem említi** a `GHCR_OWNER` / `IMAGE_TAG` / `REGISTRY`
változókat — az új operátor számára nem derül ki, hogy ezek a deploy
szempontjából kötelezőek, és hogy az üres `GHCR_OWNER` pontosan milyen
hibaüzenetet okoz a `compose pull` lépésben.

## Változtatás

A [`deploy/.env.example`](../../deploy/.env.example) `REMOTE_DIR` blokkja
után új szekció került:

* `IMAGE_TAG=latest` és `REGISTRY=ghcr.io` defaultok (a
  [`deploy/deploy.sh:299`](../../deploy/deploy.sh:299) és
  [`deploy/deploy.sh:301`](../../deploy/deploy.sh:301) sorokkal azonos
  értékek, hogy a base compose interpolációja ne térjen el a script
  defaultjától).
* `GHCR_OWNER=` üresen hagyva, de a komment egyértelműsíti:
    * a [`images.yml`](../../.github/workflows/images.yml) workflow
      `${{ github.repository_owner }}` értékével kell egyeznie,
    * üresen hagyva a deploy script a `local` defaultra esik, ami nem
      valódi GHCR tulajdonos, és a pull `error from registry: denied`
      hibával szakad meg,
    * a `postgres:16-alpine` és `caddy:2-alpine` (Docker Hub) ettől
      függetlenül elérhetők, de a teljes `pull` lánc leáll, ezért az
      ő üzeneteik is „Interrupted" státusszal jelennek meg.

A meglévő stílust követi (fejléc, leíró komment, default érték, példa).

## Ellenőrzés

1. `cp deploy/.env.example deploy/.env.dev` → a másolat most már
   tartalmazza az új szekciót `GHCR_OWNER=` üres sorral, így az
   operátor azonnal látja, hova kell beírni a GitHub org/user nevet.
3. `./deploy/deploy.sh up dev` a `GHCR_OWNER` kitöltése nélkül
   ugyanúgy `denied` hibát ad, de a hibaüzenet mostantól
   összeköthető a `.env.example` kommentjével — a hiba reprodukálható
   és a javítás egyértelmű.

## Következő lépések

* A [`deploy/.env.dev`](../../deploy/.env.dev) és
  [`deploy/.env.prod`](../../deploy/.env.prod) fájlokba be kell írni
  a tényleges `GHCR_OWNER` értéket (külön feladat, nem része ennek a
  commitnak — a felhasználó kérésére kizárólag a dokumentáció frissült).

## Frissítés (17:29) — `deploy/.env.dev` tényleges javítása

A fenti dokumentációs lépés önmagában nem volt elég: az operátor a
`GHCR_OWNER=...` sort a [`deploy/.env.example`](../../deploy/.env.example)
sablonba írta (amit közben frissítettünk), nem a ténylegesen betöltődő
[`deploy/.env.dev`](../../deploy/.env.dev) példányba. A `deploy.sh` ezért
továbbra is a base compose `${GHCR_OWNER:-local}` defaultját használta
(`ghcr.io/local/aisztens-…` → `error from registry: denied`).

A javítás: a [`deploy/.env.dev`](../../deploy/.env.dev) `REMOTE_DIR`
blokkja után új szekció került, `IMAGE_TAG=latest`, `REGISTRY=ghcr.io`
és `GHCR_OWNER=local` defaultokkal — ugyanazokkal az értékekkel, mint
amelyeket a [`deploy/deploy.sh:299`](../../deploy/deploy.sh:299),
[`deploy/deploy.sh:300`](../../deploy/deploy.sh:300) és
[`deploy/deploy.sh:301`](../../deploy/deploy.sh:301) sorokban a script
akkor is használna, ha a fájl nem tartalmazná a változókat. A `local`
itt szándékosan szerepel placeholderként: amíg a GHCR csomagok nem
léteznek a `tkovari` org/user alatt, a base compose `${GHCR_OWNER:-local}`
formája miatt a pull ugyanúgy `denied` hibát fog adni — de most már a
hiba a `GHCR_OWNER` értékre lokalizálható, nem a `deploy.sh`
rejtett default-viselkedésére. A `prod` targethez tartozó fájl
([`deploy/.env.prod`](../../deploy/.env.prod)) javítása szintén
szükséges, amint a prod droplet deployját is kézben akarjuk venni.