# 2026-10-12 10:52 — Remove the apex block from the Caddyfile template

## Context

The user pasted a `deploy.yml` run log (commit `5d8b3b9`, 2026-10-11T22:56Z) and asked me
to analyze it and make a plan to fix the issues. The deploy itself succeeded end-to-end
(images pulled, six containers recreated, image-tag verified, api healthy). The only
hard failures were the four `4/12 checks failed` lines at the end of the smoke step, plus
a steady stream of Caddy ACME errors for the apex `aisztens.hu` hostname.

The user wanted a "debug mode" walk-through: distill 5–7 candidate causes to the 1–2
most likely, validate before touching code, and then ask for explicit confirmation.

## Investigation

### Step 1 — read the log end-to-end

Six distinct signals in the log:

| #   | Severity | Where      | Signal                                                                                                                                                                                             |
| --- | -------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | red      | smoke      | `api: GET /api returns 200 ("Hello World!") (expected substring: Hello World)` — actual body `Hello Beautiful World!`                                                                              |
| S2  | red      | smoke      | `caddy: admin API on :2019/config/ responds` → `Connection refused`                                                                                                                                |
| S3  | red      | smoke      | `caddy->api: caddy can GET http://api:3000/api (expected substring: Hello World)` — actual `Hello Beautiful World!`                                                                                |
| S4  | red      | smoke      | `postgres-roles: roles aisztens, tkovari, krak exist` → `FATAL: role "root" does not exist`                                                                                                        |
| S5  | yellow   | caddy log  | `acme_client ... challenge failed ... identifier:"aisztens.hu" ... 185.80.48.2: Invalid response from http://aisztens.hu/.well-known/acme-challenge/...: 404`, then the same retry against ZeroSSL |
| S6  | info     | end of log | `Node.js 20 is deprecated ... actions/checkout@v4 ... forced to run on Node.js 24`                                                                                                                 |

8 of 12 smoke checks passed (preflight, both internal DNS lookups, caddy→postgres TCP,
both VAPI webhook 405+200 flows, monitor tick, monitor→api), so the stack is functional;
the failures looked load-bearing but are all on the smoke-test side.

### Step 2 — source mapping

S1 lives in [`scripts/test/lib/10-services.sh:104`](../../scripts/test/lib/10-services.sh:104),
S2 in the same file (the `:2019` probe), S3 in
[`scripts/test/lib/20-cross-service.sh:53`](../../scripts/test/lib/20-cross-service.sh:53),
S4 in [`scripts/test/lib/20-cross-service.sh:85`](../../scripts/test/lib/20-cross-service.sh:85).
On disk these have **already been fixed** in milestone
[`2026-10-12--09-27-00-stack-smoke-test-expectation-fixes`](../../milestones/2026-10-12--09-27-00-stack-smoke-test-expectation-fixes.milestone.md):
`Hello Beautiful World` substring, the `:2019` probe replaced with an HTTPS healthz
probe via `https://api.<DOMAIN>/healthz`, and `-U "${POSTGRES_USER:-postgres}"` added to
the psql call. The log the user pasted is from **before** that milestone, so S1–S4 will
go green on the next deploy with no further code change.

S5 lives in [`infra/caddy/Caddyfile:100-104`](../../infra/caddy/Caddyfile:100) — the
apex block `<DOMAIN> { redir https://web.<DOMAIN>{uri} 307 }`. This block was in the
live `Caddyfile.rendered` mounted into the caddy container, so Caddy was requesting a
cert for `aisztens.hu` every restart.

S6 is a GitHub-Actions deprecation warning, not a deploy failure. No action.

### Step 3 — distill candidates

Five plausible causes, ranked by likelihood:

1. **Spec drift in smoke test** (S1, S3) — `app.service.ts:6` returns `Hello Beautiful
World!`, but the test was written against the older `Hello World!`. Textbook test-rot.
2. **`admin off` hardening** (S2) — the `:2019` probe was written before Caddy's admin
   API was deliberately disabled in the `dual-stack-port-collision-fix` milestone.
3. **`docker compose exec` user mismatch on postgres** (S4) — `postgres:16-alpine`
   enters as `root`; psql authenticates over the unix socket as that OS user; no
   `root` role in postgres. Local dev lucked out; CI did not.
4. **Apex on WordPress, not on the droplet** (S5) — `dig +short aisztens.hu A` should
   return the WordPress IP. The Caddyfile has an apex block that asks for a cert Caddy
   can never get. Documented in
   [`2026-10-11--19-29-00-apex-wordpress-intentional-clarification`](2026-10-11--19-29-00-apex-wordpress-intentional-clarification.md)
   but the file was never updated.
5. **Cosmetic** — Node 20 deprecation warning (S6); `tls.cache.maintenance: storage
cleaning happened too recently` (also cosmetic).

Distilled to the **1–2 that need a code change today**:

- S5 (apex block) — real, repeatable, live on the droplet. Needs a code edit.
- S1–S4 — already fixed in the working tree, will go green on the next deploy.

### Step 4 — validate before touching code

The user asked me to run three probes on the droplet first:

**Probe #1** — `docker compose exec caddy cat /etc/caddy/Caddyfile`:
The apex block is present in the live rendered file (the substitution was performed,
so the block reads `aisztens.hu { redir https://web.aisztens.hu{uri} 307 }`). Confirmed.

**Probe #2** — public DNS:

```
aisztens.hu         → 185.80.48.2       (separate WordPress server, NOT the droplet)
api.aisztens.hu     → 164.92.248.194    (this droplet)
web.aisztens.hu     → 164.92.248.194    (this droplet)
admin.aisztens.hu   → 164.92.248.194    (this droplet)
droplet eth0        → 164.92.248.194/20
```

The apex literally does not point at this droplet. Confirmed.

**Probe #3** — fresh ACME log line: Let's Encrypt's own error message names the IP it
queried: `185.80.48.2: Invalid response from http://aisztens.hu/.well-known/acme-challenge/...: 404`.
Caddy then retries against ZeroSSL with the same `http-01` challenge. Certs for the
three subdomains were issued fine (`got renewal info` lines for `admin.`, `api.`,
`web.`). Confirmed: the apex is the only ACME problem, and the cause is the apex block
trying to serve a host Caddy cannot reach.

### Step 5 — ask the user

I presented the diagnosis to the user with the three probe results and asked for explicit
confirmation before changing the Caddyfile. The user picked the option: "Run the 3
validation probes on the droplet first, then drop the apex block from
infra/caddy/Caddyfile so Caddy stops attempting ACME for aisztens.hu."

## Fix

### Code change

In [`infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile), replaced the 5-line apex
block (lines 100–104) with a multi-line comment that:

- States plainly that the apex is intentionally NOT served from this droplet (DNS
  points at the WordPress server).
- Explains the symptom: Caddy would request a Let's Encrypt cert for a host it
  cannot serve, the http-01 challenge would be served by the WordPress server
  (which returns 404 for `.well-known/acme-challenge/...`), and ACME would loop
  forever.
- Points at the two existing docs that already record the intent
  (`docs/history/2026-10-11--19-29-00-apex-wordpress-intentional-clarification.md`
  and `docs/Specs/Caddy-Reverse-Proxy.md`).
- Includes the _commented-out_ apex block as a copy-paste target for the day the
  apex is ever migrated to this droplet, so a future contributor does not have to
  re-invent it from memory.

The `Render Caddyfile` step in `deploy.yml` and the `render_caddyfile` function in
`deploy/deploy.sh` are **unchanged** — they still `sed`-substitute `<DOMAIN>` and
`<ACME_EMAIL>`; the template just no longer contains an apex block to render.

### Spec update

[`docs/Specs/Caddy-Reverse-Proxy.md` §A](../../Specs/Caddy-Reverse-Proxy.md) was updated:

- The previous text claimed the block "kikerül a Caddy-ból — sosem fut le". That was
  a hope, not reality: the block was in `Caddyfile.rendered` and Caddy _did_ try to
  obtain a cert. The new text states the block has been **removed from the template**
  and explains why, and describes the two-step process (DNS A-record change +
  uncomment the block) that would be needed if the apex is ever migrated.
- The "Utolsó frissítés" header at the top of the spec was extended with a new
  dated entry pointing at this history file, per the project's specs-maintenance
  rule.

## Verification

The change is live in the working tree but the running Caddy container on the droplet
still has the old rendered file. The next `deploy.yml` run (push to `dev` or
`workflow_dispatch`) will:

1. SCP-ship the new `infra/caddy/Caddyfile` template and the new `infra/caddy/Caddyfile.rendered`
   to the droplet.
2. Trigger `docker compose up -d --force-recreate caddy`, which mounts the new rendered
   file at `/etc/caddy/Caddyfile` and restarts the caddy container.
3. Caddy will then attempt ACME only for `api.aisztens.hu`, `web.aisztens.hu`,
   `admin.aisztens.hu` (already working) — not for the apex.
4. The `docker compose logs caddy` ACME noise will disappear.

To confirm manually before/after the next deploy:

```bash
# Inside the running caddy container:
docker compose exec caddy cat /etc/caddy/Caddyfile | grep -E '^[a-z]+\.aisztens\.hu' || true
# Before: api.aisztens.hu, web.aisztens.hu, admin.aisztens.hu, aisztens.hu
# After:  api.aisztens.hu, web.aisztens.hu, admin.aisztens.hu  (no apex)

# From the droplet, after a few minutes:
docker compose logs --no-color --tail=200 caddy | grep -E 'identifier:"aisztens\.hu"' || echo "no apex ACME attempts"
# After:  "no apex ACME attempts"
```

## Follow-ups (deferred)

- **S6** — Node 20 deprecation warning at the end of the `deploy.yml` log
  (`actions/checkout@v4` is being forced to Node 24). Track separately; does not
  block deploys.
- **CORS origin** — `infra/.env.example` still documents the older CORS list
  including `https://api.aisztens.hu`. The dev `infra/.env.dev` is already correct
  (web+admin only), so this is template-only and harmless; can be cleaned up as a
  doc-PR later.
- **Caddy storage-cleaning "skipped" line** — cosmetic, Caddy's own rate-limit,
  nothing to do.
