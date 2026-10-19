# Plan — `.env` fájlok biztonságos tárolása és automatikus frissítése

**Date:** 2026-10-01
**Author:** architect mode (Zoo)
**Status:** awaiting user approval
**Related artefacts:**
- [`deploy/deploy.sh`](../../deploy/deploy.sh) — local deploy helper (rsync + scp)
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — CI deploy (mirror of deploy.sh)
- [`infra/docker-compose.yml`](../../infra/docker-compose.yml) — runtime env consumption
- [`deploy/README.md`](../../deploy/README.md) — current runbook
- [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) — verifikációs runbook

---

## 0. A jelenlegi állapot röviden

A projektben ma **három** `.env`-szerű fájl él, és ezeknek a kezelése a deploy pipeline-ban részben már automatizált, részben még manuális:

| Fájl | Local (Win/WSL/Git Bash) | Droplet | Forrás / update mechanizmus |
|---|---|---|---|
| [`deploy/.env`](../../deploy/.env) | kézzel másolva `deploy/.env.example`-ból, saját SSH-host + kulcs + userek | kézzel `scp`-zve a `deploy.sh upload` lépcsőben | kézzel kell szerkeszteni, deploy-sh scp-zi fel |
| [`infra/.env`](../../infra/.env) | kézzel másolva `infra/.env.example`-ból | jelenleg is GitHub Actions `INFRA_ENV` secret-ből renderelve a CI workflow-ban (részletesen lásd lejjebb); local deploy esetén `deploy.sh` scp-zi fel | CI: secret alapján automata; local: manuális |
| `apps/{web,admin,api}/.env` (dev only) | kézzel | nincs a dropleten (csak `import.meta.env.VITE_*` build-time, compose-on nem használt) | `vite.config.ts` proxy-ja a dev szerveren |

Amit a [`deploy/README.md`](../../deploy/README.md) §1 és §8.1 ma leír:
- **CI oldalon** ([`.github/workflows/deploy.yml:65-75`](../../.github/workflows/deploy.yml:65)): a `Render infra/.env from secret` step a `$INFRA_ENV` GitHub Secret tartalmát `printf '%s\n' "$INFRA_ENV" > infra/.env` formában írja ki, `chmod 600`-al, és utána [`appleboy/scp-action`](../../.github/workflows/deploy.yml:109) egy külön lépésben tolja fel a dropletre.
- **Local oldalon** ([`deploy/deploy.sh:190-211`](../../deploy/deploy.sh:190)): ha a lokális `infra/.env` létezik, `scp` feltolja a dropletre.

**Amit a felhasznál most kér:**
> „hol tároljuk ezeket, amikor pl deployolunk githubról? hogyan tároljuk biztonságosan, de elérhető módon? Készíts tervet arra, hogy hogyan automatizáljuk a tárolást, módosíthatóságot és a frissülést egy deploy alkalmával. Szeretném, ha nem kéne semmit kézzel másolgatni!"

A válasz három részből áll: (1) a **teljes átalakítás** (Docker secrets / Vault / SOPS) komplexitás-listája, (2) egy **3-fázisú útiterv**, ami a „teljeset” is tartalmazza, de apró lépésekben szállítható, és (3) minden fázisra egy-egy **konkrét akcióterv** a deploy pipeline-hoz.

---

## 1. „Mennyire bonyolult a teljes átalakítás?” — komplexitás-lista

Ez a lista azokat a munkadarabokat sorolja fel, amikbe belenyúlunk, ha a mostani GitHub-Secrets-alapú, „plain text in container env var" megoldásról átállunk egy ipari titokkezelőre (Docker secret / SOPS-encrypted git / Vault / 1Password Connect). Minden elemhez odaírom, hogy **kis, közepes vagy nagy** az adott feladat, és hogy a projekt jelenlegi állapotában miért.

| # | Feladat | Nehézség | Miért |
|---|---|---|---|
| 1 | A compose fájlok átírása: minden `${VAR}` → `file:///run/secrets/var` (Docker secret), vagy → `*_FILE` indítóscript (Vault Agent) | **közepes** | Jelenleg minden secret a compose `environment:` blokkjában van ([`infra/docker-compose.yml:29-33`](../../infra/docker-compose.yml:29), [`67-79`](../../infra/docker-compose.yml:67), [`113-115`](../../infra/docker-compose.yml:113)). A NestJS indítóscriptje ( [`infra/app/Dockerfile`](../../infra/app/Dockerfile)) és a postgres init script ([`infra/postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh)) is közvetlenül olvassa a `$VAR`-t. Minden olvasási pontot érinteni kell, és a `*_FILE` indítóscriptes megoldásnál új réteget (envsubst / entrypoint shim) kell bevezetni. |
| 2 | Backend (apps/api) kód átírása, hogy ne `process.env.X`, hanem indításkor a `*_FILE` tartalmából olvassa a `DATABASE_URL`-t, `VAPI_WEBHOOK_SECRET`-et stb. | **közepes** | A [`NestJS @nestjs/config`](../../apps/api/src/main.ts) alapértelmezetten `process.env`-ből olvas, és a `ConfigService.get('X')` indításkor fut le. A `*_FILE` indítóscriptes megoldásnál az entrypoint (`infra/app/Dockerfile`) `envsubst`/`while-read` loopja tölti fel a `process.env`-et, mielőtt a node elindul — ez egy plusz indítási pont, ami lassítja a cold startot és hibalehetőség. |
| 3 | Caddy container átállítása: jelenleg a `Caddyfile.rendered` mounton kapja a `DOMAIN` / `ACME_EMAIL` értékeket ([`infra/docker-compose.yml:120-128`](../../infra/docker-compose.yml:120)) — Caddy natívan nem támogatja a Docker secretet, csak env var-t és file mountot; ha secretként tárolnánk, a Caddyfile renderelőnek kell a `/run/secrets/<x>`-ből olvasnia | **kis–közepes** | A [`deploy/deploy.sh:render_caddyfile()`](../../deploy/deploy.sh:142) most `sed`-del helyettesít; ha secret mountra állunk át, a renderelőt át kell írni, hogy `cat /run/secrets/...` legyen a forrás, vagy marad az env-file mount, és csak a *forrás* titkosítódik. |
| 4 | Vite build (apps/web, apps/admin) — jelenleg `VITE_API_BASE_URL` build-time injektálás a `pnpm build` során ([`deploy/deploy.sh:99-111`](../../deploy/deploy.sh:99)) | **nincs teendő, ha jól döntünk** | A Vite kizárólag build-time olvas ( `import.meta.env.VITE_*` ), tehát a build artifact nem tartalmaz titkokat (csak publikus API URL-t). Ha a CI workflow-ból (ahol ma is a [`$INFRA_ENV` secretből](../../.github/workflows/deploy.yml:146) olvassa a DOMAIN-t) el tudjuk érni ugyanazt a DOMAIN-t anélkül, hogy a teljes `INFRA_ENV`-t a CI runner memóriájába töltenénk — külön `DOMAIN` secret kell. |
| 5 | **SOPS titkosítás a git-ben**: minden `*.env` → `*.env.enc`, age/key pair a droplet + CI runneren | **nagy** | Minden olvasási pont (compose, Dockerfile, deploy.sh, GitHub Actions step, lokális dev scriptek) tudnia kell, hogy `sops --decrypt ...` fusson használat előtt. A [`scripts/test/stack-up.sh`](../../scripts/test/stack-up.sh) és [`scripts/test/stack-smoke.sh`](../../scripts/test/stack-smoke.sh) szintúgy. Age-key rotáció és a kulcs tárolása (CI: GitHub Secret, droplet: `/etc/aisztens/keys/`, fejlesztő gép: 1Password) egyaránt kidolgozandó. |
| 6 | **Vault Agent indítóscript** a dropleten: külön konténer vagy host-oldali systemd unit, ami Vault-ból húz, kiírja `/run/secrets/*`-ba, a compose csak onnan olvas | **nagy** | Vault self-host üzemeltetés (HA, unseal, audit log), vagy felhő (HCP Vault / AWS Secrets Manager) — utóbbi járulékos költséggel. A postgres jelszavak, VAPI webhook secret és a `CORS_ORIGINS` mind külön path-ok, ACL-eket kell írni. |
| 7 | **Docker Swarm / Kubernetes** átállás a natív Docker secret támogatáshoz | **nagy** | A projekt most standalone Docker Compose-t használ ([`infra/docker-compose.yml:15`](../../infra/docker-compose.yml:15) `name: aisztens`). Swarm init a dropleten, vagy k3s telepítés (extra RAM a 2 GB-os dropleten — kritikus, mert most is [`400m` mem cap van az api-n](../../infra/docker-compose.yml:28)). A swarm secrets overlay network-ön megy, de nincs automatikus rotáció. |
| 8 | Audit log: ki, mikor, milyen secretet olvasott | **közepes** | A GitHub Actions `INFRA_ENV` secret-nél van workflow log, amiben benne van a teljes file (veszélyes: a CI log-ban a teljes jelszó látszik!), és a dropleten a `~/.bash_history` + `docker inspect` JSON kimenti. Vault / SOPS bevezetésekor ez automatikus, de most hiányzik. |
| 9 | **Titok-rotáció workflow** (jelszócsere container rebuild nélkül): ha pl. a postgres jelszó lejár, anélkül cserélhető legyen, hogy minden konténert újra kellene buildelni | **közepes–nagy** | Most a [`deploy.sh up`](../../deploy/deploy.sh:293) mindig `docker compose up -d --build`, ami újraépíti a képeket (5-10 perc a hideg pnpm install miatt). Ha csak env-t akarunk rotálni, egy külön `deploy.sh rotate-secret <NAME>` parancs kell, ami `docker compose up -d --no-build <service>`-et hív, vagy a konténeren belüli SIGHUP-ot küldi a postgres `pg_ctl reload`-hoz / Caddynek (azonnali config reload). |
| 10 | **Game-day / DR**: titok elvesztése, kulcs kompromittálódás, droplet compromise | **nagy** | Ha age-key (SOPS) vagy Vault root token elveszik → minden titok elveszik. Backup + restore procedúra kell, és rendszeres (3) forgatási drill. |
| 11 | Két env (staging/prod) szétválasztása, environment protection rules a GitHubon | **kis–közepes** | Jelenleg egyetlen `production` environment van ([`.github/workflows/deploy.yml:50`](../../.github/workflows/deploy.yml:50)). A staging droplet + saját `INFRA_ENV_STAGING` secret + saját `deploy-staging.yml` kb. fél nap munka. |
| 12 | Compliance (GDPR / SOC2) — kik, milyen titokhoz férnek hozzá | **nagy, ha kell** | Ha egyszerűsíteni akarjuk a `INFRA_ENV` secret kezelését, a GitHub team / SSO audit log az egyetlen forrás. Vault / SOPS audit ehhez képest sokkal gazdagabb. |

### Összefoglaló

A „teljes átalakítás” ≠ egy lépés. A legkisebb haszonmaximális ugrás (F1 + F2 lentebb) **kis**, és 80%-át megoldja annak, amit a felhasznál kért („ne kelljen semmit kézzel másolgatni”). A „maradék 20%” (igazi titokkezelő, audit, rotáció, DR) **nagy** projekt, és **akkor éri meg**, ha a projekt scale-je vagy compliance-igénye megköveteli. Jelenlegi 1-droplet + 1-dev-projekt scope-pal **az F1+F2 ajánlott**, az F3 opcionális, késleltethető.

---

## 2. A 3-fázisú útiterv

### Fázisok áttekintése

```mermaid
flowchart LR
    subgraph MAI["Mai állapot (2026-10-01)"]
        A1[Lokális .env<br/>kézzel] -->|scp| A2[Droplet .env]
        A3[GH Actions INFRA_ENV<br/>secret + scp] --> A2
    end

    subgraph F1["F1 · Szigorítás + repo titkok (kis)"]
        B1[Lokális .env<br/>1Password / Bitwarden] -->|deploy.sh| B2[Droplet .env<br/>chmod 600, audit log]
        B3[GH Actions: külön<br/>DOMAIN, INFRA_ENV, SSH_KEY<br/>secret-ek] -->|scp + audit| B2
    end

    subgraph F2["F2 · Titok-rotáció (közepes)"]
        C1[deploy.sh rotate-secret] --> C2[docker compose up --no-build]
        C3[GitHub Actions: workflow_dispatch<br/>rotate-only path] --> C2
    end

    subgraph F3["F3 · Valódi titokkezelő (nagy, opcionális)"]
        D1[SOPS titkosított<br/>env.enc a repo-ban] --> D2[Sops-decrypt a<br/>compose entrypoint-ban]
        D3[Vault / HCP Vault<br/>Agent] --> D4[/run/secrets/* mount]
    end

    MAI -.upgrade.-> F1
    F1 -.upgrade.-> F2
    F2 -.upgrade.-> F3
```

Minden fázis önállóan is értékes; nem kell mindet megcsinálni.

---

### Fázis 1 — Szigorítás és a `deploy.sh` + GitHub Actions „kéznélküli” működés

**Cél:** A lokális `.env` fájlok is ugyanúgy „kéznélküli” workflow-t kapjanak, mint a CI, és a CI secret ne tartalmazza az egész `infra/.env`-t egyetlen monoliten.

**Scope:**
- A lokális `deploy/.env` és `infra/.env` tárolása 1Password / Bitwarden vaultban (vagy bármilyen jelszókezelőben), onnan copy-paste a deploy előtt → a deploy scriptbe épített `read -s` interaktív prompt, vagy a deploy script átvesz egy `--from-1password` flaget.
- A GitHub Actions `INFRA_ENV` monolitet daraboljuk: `DOMAIN`, `ACME_EMAIL`, `INFRA_DB_SECRETS` (postgres jelszavak), `INFRA_API_SECRETS` (`VAPI_WEBHOOK_SECRET`, `MONITOR_ALERT_WEBHOOK_URL`), `INFRA_CORS_ORIGINS`. Ez azért jó, mert:
    - A CI logban csak az a secret jelenik meg, amelyiket az adott step használja.
    - A `DOMAIN` / `ACME_EMAIL` rotációjához nem kell az egész `INFRA_ENV` secretet cserélni.
- A [`deploy.sh` `upload()` lépcsője](../../deploy/deploy.sh:172) kiegészül egy „diff vs előző deploy" lépéssel: ha a lokális `.env` nem változott, ne scp-zza fel újra.
- A `infra/.env` a dropleten kapjon `chmod 600`-at és legyen a `deployer` user tulajdona (most is `chmod 600`-as a deploy, de a tulajdonos marad `root`).
- Audit trail: a deploy.sh írjon egy `~/.deploy-audit.log`-ot a dropletre, ki-mikor-mit töltött fel.

**Érintett fájlok (becsült):**
- [`deploy/deploy.sh`](../../deploy/deploy.sh) — `upload()` kiegészítés, új `audit-log` helper
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — secret-ek szétbontása, külön env-ek rendering lépései
- [`deploy/README.md`](../../deploy/README.md) — §8.1 „Repository secrets” tábla frissítése
- Új: [`deploy/lib/audit.sh`](../../deploy/lib/audit.sh) — minimális audit helper

**Kockázat:** alacsony. Visszafelé kompatibilis: a mai `INFRA_ENV` monolitet egy ideig párhuzamosan támogatjuk, és a deploy flagjével (`--secret-mode=legacy|split`) választható.

**Rollback:** ha bármi elromlik, a `INFRA_ENV` marad a backup, a régi deploy.sh lépés visszaállítható.

**Manuális másolgatás a fázis végén:**
- A CI oldalon: **nincs** — minden secret a GitHub Secrets-ben, onnan renderelve.
- A local oldalon: **1 db interaktív prompt** a deploy indítása előtt, vagy 1Password CLI hívás. (Vagy opcionálisan: a `deploy.sh` fogad paraméterben egy `OP_VAULT` URL-t és letölti.)

---

### Fázis 2 — Titok-rotáció container-rebuild nélkül

**Cél:** Ha változik egy jelszó / webhook secret, ne kelljen `docker compose up -d --build` (5–10 perc), hanem egy gyors `restart`-szerű lépéssel érvényesüljön.

**Miért fontos:**
- A mostani [`deploy.sh up`](../../deploy/deploy.sh:293) mindig `up -d --build`, ami a `pnpm install` miatt lassú, és a build cache elvesztésével járhat.
- Egy jelszó-rotáció (pl. `POSTGRES_PASSWORD` cseréje) nem igényli buildet — csak a `postgres` service-t kell újraindítani (a [`postgres init script](../../infra/postgres/init/01-roles.sh) újrafuttatása viszont igényli, ami csak tiszta volume esetén fut le, lásd lentebb).
- A Caddy azonnal fogja a `Caddyfile.rendered` új tartalmát, ha a file mount `bind`-es (most az).

**Scope:**
- Új [`deploy.sh` parancs: `rotate-secret <NAME>`](../../deploy/deploy.sh): a script megkapja, melyik env változó új (pl. `VAPI_WEBHOOK_SECRET`), és:
    1. Frissíti a lokális `infra/.env`-t (interaktív prompt vagy argumentum).
    2. `scp`-zi a dropletre (a F1-ben bevezetett audit log-ot használja).
    3. `docker compose up -d --no-build <service>` (compose restart, nincs build).
- A [`compose file-okban`](../../infra/docker-compose.yml) a `*_FILE` indítóscriptes megoldás előkészítése: a service-ek entrypointjai képesek legyenek a file mountból olvasni (Docker secret előkészítés — lásd F3).
- A GitHub Actions-ba egy `workflow_dispatch` path, ami csak a `rotate-secret` workflow-t futtatja (build step-ek kihagyásával).

**Érintett fájlok:**
- [`deploy/deploy.sh`](../../deploy/deploy.sh) — új `rotate-secret` parancs
- [`deploy/README.md`](../../deploy/README.md) — §5 „Day-to-day” kiegészítés
- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml) — külön `rotate` job + `workflow_dispatch` trigger
- [`infra/docker-compose.yml`](../../infra/docker-compose.yml) — comment a `*_FILE` migrációhoz
- [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) — §4.4 „Titok-rotáció” alpont

**Kockázat:** közepes. Két edge case:
- A `postgres` volume-ot nem szabad `down` nélkül „elveszteni”, mert a [`postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh) csak első indításkor fut. A jelszó-rotáció a DB-n belüli `ALTER USER ... WITH PASSWORD '...'` SQL-t igényli, amit a deploy.sh előtt kell futtatni (vagy a deploy.sh automatikusan SSH-n keresztül).
- A Caddy `Caddyfile.rendered` mount `bind`-es, de ha bármikor `docker-compose.yml` mount-ról volume-ra váltunk, elveszítjük az azonnali reload-ot.

**Rollback:** ha a rotate hibás, a `git revert` + push-deploy visszaállítja a korábbi `.env` értéket (a compose újraindítja a service-t).

---

### Fázis 3 — Valódi titokkezelő (opcionális, nagy)

**Cél:** A `INFRA_ENV` GitHub Secret és a lokális `infra/.env` is **megszűnik** plain text formában létezni. Helyette:

**3a. SOPS (Mozilla) + age titkosítás a repo-ban:**
- `infra/.env` → `infra/.env.enc`, decrypt csak a dropleten + CI runneren lévő age private key birtokában.
- Előny: a teljes konfig verziókezelt, auditálható, de titkosítva tárolódik.
- Hátrány: minden olvasási pont (`compose`, Dockerfile, deploy.sh) tudnia kell, hogy `sops --decrypt ...` fusson használat előtt. Ez a F1+F2 tudásbázisra épít.

**3b. Vault (HashiCorp) — HCP Vault felhőben, vagy self-host:**
- A dropleten fut egy Vault Agent systemd unitként, ami a CI workflow triggerére vagy a deploy.sh hívására frissíti a `/run/secrets/*` file-okat.
- A compose file-ban `${VAR}` helyett `_FILE=/run/secrets/var`, és az entrypoint shim (minden service Dockerfile-jában) beolvassa a file-t és felülírja a `process.env.VAR`-t indulás előtt.
- Előny: központi audit, RBAC, automatic rotation, dinamikus titkok (pl. lease alapú DB hitelesítés).
- Hátrány: Vault üzemeltetés (HA, unseal, backup), költség (HCP Vault: ~$0.50/óra starter tier), a `*_FILE` indítóscript miatt lassabb cold start.

**Érintett fájlok:**
- Minden `infra/docker-compose.yml` service — env → `_FILE` migráció
- [`infra/app/Dockerfile`](../../infra/app/Dockerfile) — entrypoint shim
- [`deploy/deploy.sh`](../../deploy/deploy.sh) — Vault login / SOPS decrypt lépés
- Új: [`deploy/lib/secrets-backend.sh`](../../deploy/lib/secrets-backend.sh) — provider-absztrakció (sops|vault|env)
- [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) — Caddyfile renderelés forrása (env → secret)
- [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) — teljes §6 átírás

**Kockázat:** nagy. Komplexitás: kb. 1-2 hét aktív munka + Vault üzemeltetés. **Csak akkor éri meg, ha:**
- Több service-t futtatunk (jelenleg 4), vagy
- Compliance-kötelezettség van (GDPR / SOC2), vagy
- A dev / staging / prod szétválasztása igényel centralizált auditot.

---

## 3. Melyik fázist válasszam?

| Szempont | F1 | F2 | F3 |
|---|---|---|---|
| Megoldja-e a „kézzel másolgatás” problémát? | részben (CI-n igen, local-on 1 prompt marad) | igen (titok-rotációnál is) | igen |
| Mennyi munka? | **kis** | **közepes** | **nagy** |
| Visszafelé kompatibilis? | igen (rollback 1 PR) | igen (külön parancs) | nem (áttörés) |
| Kell-e Vault / új infra? | nem | nem | igen |
| Audit / RBAC | minimális (audit log file) | minimális | teljes |
| Ajánlott? | **igen, azonnal** | **igen, F1 után** | csak ha a scale / compliance indokolja |

---

## 4. Akcióterv a jóváhagyott fázis(ok)hoz

Az alábbi lista azokat a konkrét lépéseket sorolja fel, amiket a kód módban kell végrehajtani, ha a felhasznál jóváhagyja a tervet. A sorrend betartása fontos, mert minden fázis az előzőre épül.

### Ha az F1-et választjuk (ajánlott minimum)

1. **GitHub Secrets szétbontása** — A CI workflow-ban a [`Render infra/.env from secret`](../../.github/workflows/deploy.yml:65) stepet három lépésre bontani: `Render DOMAIN+ACME_EMAIL`, `Render DB secrets`, `Render API secrets`. A deploy.sh scp-jét is három scp-re bontani, hogy a CI logban csak az érintett secret jelenjen meg.
2. **deploy.sh `upload()` audit log** — A [`deploy.sh:172`](../../deploy/deploy.sh:172) `upload()` végén írjon a dropletre egy `~/.deploy-audit.log` sort: timestamp, scp forrás + cél, hash-of-the-old-file, hash-of-the-new-file. (Nem logoljuk a tartalmat, csak a hash-t, hogy a későbbi audit lássa, mi változott.)
3. **Local 1Password hook** — Új [`deploy/lib/1password.sh`](../../deploy/lib/1password.sh): a deploy.sh fogadja a `--from-1password` flaget, ami a `op read "op://vault/aisztens/item/infra.env"` hívással tölti be a lokális `infra/.env`-t. Ha nincs `op` CLI vagy a flag nincs megadva, marad a régi kézi másolás.
4. **`deploy/README.md` frissítés** — §8.1 „Repository secrets” tábla bontása, §1 „Local preparation” kiegészítése a 1Password opcióval.
5. **`docs/Specs/Production-Runbook.md` frissítés** — §4.4 új alpont: „Hol vannak a titkaink, és hogyan rotálódnak?” Hivatkozás a [`deploy/README.md`](../../deploy/README.md) §8.1-re, és a CI workflow secret-listájára.
6. **Dokumentáció** — Új history bejegyzés: `docs/history/2026-10-XX--HH-MM-SS-env-storage-f1-impl.md`, és egy milestone: `docs/milestones/2026-10-XX--HH-MM-SS-env-storage-f1.milestone.md` (M1+F1 kategóriájú, mert ez is „biztonsági javítás + automatizálás” téma).

### Ha az F1 + F2-t választjuk (ajánlott teljes)

Az F1 lépései + az alábbiak:

7. **`deploy.sh rotate-secret <NAME>` parancs** — A [`deploy/deploy.sh`](../../deploy/deploy.sh) case-ág kiegészítése: a parancs fogad egy secret nevet (pl. `VAPI_WEBHOOK_SECRET`), bekéri az új értéket (interaktívan vagy `--new-value=` flaggel), frissíti a lokális `.env`-t, scp-zi a dropletre, majd `docker compose up -d --no-build <service>`-t futtat.
8. **GitHub Actions `rotate` job** — Új `workflow_dispatch` path a deploy.yml-ban, ami kihagyja a build + SPA build + smoke step-eket, és csak a rotate-secret lépést futtatja.
9. **Postgres jelszó-rotáció külön esete** — A [`postgres/init/01-roles.sh`](../../infra/postgres/init/01-roles.sh) által definiált userek (`tkovari`, `krak`, `aisztens`) jelszava a `infra/.env`-ben van (`TKOVARI_DB_PASSWORD`, `KRAK_DB_PASSWORD`, `AISZTENS_DB_PASSWORD`). Ezek rotációjakor a compose restart nem elég — `psql` `ALTER USER` SQL-t kell futtatni a deploy.sh-n belül, a dropleten SSH-n keresztül. Ez egy külön `deploy.sh rotate-db-password` parancs legyen, ami a `docker exec postgres psql ...` hívást használja.
10. **`docs/Specs/Production-Runbook.md` frissítés** — §4.4 „Titok-rotáció” alpont részletezése (postgres / VAPI / CORS / monitor webhook mind külön alpont).
11. **Audit log bővítés** — A rotate-secret parancs az audit logba írja a régi → új hash-t (tartalom nélkül).
12. **History + milestone** — `docs/history/2026-10-XX--HH-MM-SS-env-storage-f2-impl.md` + `docs/milestones/2026-10-XX--HH-MM-SS-env-storage-f2.milestone.md`.

### Ha F3-at is (opcionális, nagy)

A F1+F2 lépései + az alábbiak — ezt külön tervezési fázisban kell részletezni, mert a `*_FILE` indítóscriptes átállás és a Vault üzemeltetés önmagában is egy-egy terv:

13. `infra/docker-compose.yml` env → `_FILE` migráció (4 service)
14. [`infra/app/Dockerfile`](../../infra/app/Dockerfile) entrypoint shim (sops-decrypt + env-beírás)
15. SOPS age-key rotáció + Vault Agent konfiguráció
16. `docs/Specs/Caddy-Reverse-Proxy.md` és `docs/Specs/Production-Runbook.md` teljes átírás az új secret-folyamhoz

---

## 5. Spec doksi frissítési javaslat

Az F1+F2 elfogadása esetén az alábbi spec doksik frissítése szükséges:

| Spec | Mit kell frissíteni |
|---|---|
| [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) | §4.4 új alpont: titkok tárolása, rotáció módja, audit log. Hivatkozás a [`deploy/README.md`](../../deploy/README.md) §8.1 frissített táblájára. A `**Utolsó frissítés:**` sor frissítése a dátumra. |
| [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) | Ha F2-t is választunk: §3.2 „Caddyfile renderelés” alpont kiegészítése azzal, hogy a renderelés forrása a deploy.sh `rotate-secret` workflow-ban is lefuthat, nem csak teljes `up` esetén. |
| [`deploy/README.md`](../../deploy/README.md) | §1 „Local preparation” + §8.1 „Repository secrets” tábla + §8.2 „What the workflow does” — mind frissül. |

A szabály a [`docs/Specs/Production-Runbook.md`](../../docs/Specs/Production-Runbook.md) és [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) **fejlécében lévő `**Utolsó frissítés:**` sort** a változtatással egy időben frissíteni kell.

---

## 6. Következő lépések (a felhasználó döntése után)

1. **Döntsd el, melyik fázist választod** (F1, F1+F2, vagy F1+F2+F3).
2. **Erősítsd meg a local titokkezelőt**: 1Password / Bitwarden / `pass` / saját `~/.env.encrypted` — ez határozza meg, hogy a [`deploy/lib/1password.sh`](../../deploy/lib/1password.sh) melyik backendet implementálja.
3. **Erősítsd meg, hogy a CI secret-eket most szétbontjuk-e**: ha igen, a deploy.sh-t és a deploy.yml-t egyszerre kell frissíteni (különben a CI elromlik).
4. **A jóváhagyás után** architect mode átadja a tervet code mode-nak, ami a fenti akcióterv alapján megvalósítja.
5. Az elkészült kódot history + milestone bejegyzéssel zárjuk, és a Production-Runbook spec-et a szabályok szerint frissítjük.