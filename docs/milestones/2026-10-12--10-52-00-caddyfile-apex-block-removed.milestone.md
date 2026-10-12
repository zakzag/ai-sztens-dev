# Caddyfile apex block removed — ACME for `aisztens.hu` stopped

## 1. Problem / feature

A `deploy.yml` run on `dev` (commit `5d8b3b9`, 2026-10-11T22:56Z) reported
`4/12 checks failed` in the smoke step and a constant stream of
`could not get certificate from issuer` lines for the apex `aisztens.hu`
hostname in the caddy container log. The deploy itself worked end-to-end
(images pulled, six containers recreated, image-tag verified, api healthy);
only the smoke step was red and only the apex ACME flow was misbehaving.

The 4/12 failures were **smoke-test expectation drift** (`Hello World!` vs
`Hello Beautiful World!`, an `admin off` Caddyfile vs an `:2019` admin-API
probe, a `psql` exec without `-U` on a `postgres:16-alpine` image whose
primary user is `root`). All four were already fixed in milestone
[`2026-10-12--09-27-00-stack-smoke-test-expectation-fixes`](2026-10-12--09-27-00-stack-smoke-test-expectation-fixes.milestone.md),
so the log was a snapshot from before those fixes.

The **apex ACME failure** was a real, repeatable, on-the-droplet issue that
the earlier fixes did not address.

## 2. Measured data / evidence

Three live probes run on the droplet before touching any code:

| Probe | Command | Result |
|---|---|---|
| 1 | `docker compose exec caddy cat /etc/caddy/Caddyfile` | Apex block present and rendered: `aisztens.hu { redir https://web.aisztens.hu{uri} 307 }`. Three other site blocks (`api.`, `web.`, `admin.`) also present. |
| 2 | `dig +short aisztens.hu A` | **`185.80.48.2`** (NOT the droplet). `api./web./admin.` → `164.92.248.194` (droplet). Droplet eth0 = `164.92.248.194/20`. |
| 3 | `docker compose logs --tail=300 caddy \| grep identifier:\"aisztens.hu\"` | `http-01` challenge details literally: `"185.80.48.2: Invalid response from http://aisztens.hu/.well-known/acme-challenge/...: 404"`. Caddy then retries against ZeroSSL. |

The three subdomains' certs were issued and renew normally (`got renewal info`
lines present for all three). Only the apex is unreachable from this droplet.

Counter-evidence the stack is healthy (the 8 smoke checks that passed):
preflight, `caddy → api` DNS, `api → postgres` DNS, `caddy → postgres` TCP,
caddy 405 VAPI pre-filter, caddy 200 VAPI HMAC-accept, monitor tick,
monitor → api recent check.

## 3. Root cause or design rationale

The apex `aisztens.hu` is intentionally served by a **separate WordPress
server** (`185.80.48.2`) for legacy reasons
([`docs/history/2026-10-11--19-29-00-apex-wordpress-intentional-clarification.md`](../history/2026-10-11--19-29-00-apex-wordpress-intentional-clarification.md)).
The droplet's Caddy was never meant to terminate TLS for it. However, the
`Caddyfile` template still contained an apex block — `<DOMAIN> { redir
https://web.<DOMAIN>{uri} 307 }` — that the `sed` renderer substituted into
`Caddyfile.rendered`. Caddy loaded that file and dutifully started
requesting a Let's Encrypt certificate for the apex. The ACME `http-01`
challenge hit the WordPress server (because that's where DNS points), the
WordPress server returned `404` for `/.well-known/acme-challenge/...`, and
Caddy logged `could not get certificate from issuer` every ~10 s, then
retried against ZeroSSL with the same outcome.

**Design decision:** remove the apex block from the template, replacing it
with an inline comment that explains why it is absent, points at the
existing docs that record the intent, and keeps the original block
**commented out** as a copy-paste target for the day the apex is ever
migrated to this droplet. This is the smallest change that removes the
permanent failure mode without losing the future option. The placeholder
convention (`<DOMAIN>` / `<ACME_EMAIL>`), the `sed` rendering, and the
deploy-time mount path are all untouched, so the change is contained to
the template file plus a doc update.

**Alternatives considered:**

- *Add a `servers` block that excludes the apex from ACME.* More moving
  parts; depends on Caddy version-specific directives; Caddy still logs a
  warning that it ignored the apex site address.
- *Set the apex A record to the droplet.* Out of scope (the WordPress
  site is the apex on purpose; changing DNS is a separate decision).
- *Drop the rendered Caddyfile from git and patch the docker-compose
  entry to mount the template directly.* The sed-rendering exists so the
  file is inspectable and the `{{DOMAIN}}` token convention is enforced,
  so this would be a regression in operability.

## 4. Solution / implementation

| File | Change |
|---|---|
| [`infra/caddy/Caddyfile`](../infra/caddy/Caddyfile) | Replaced the 5-line apex block (lines 100–104 in the previous revision) with a 17-line comment that states why the apex is absent, points at the two existing docs that record the intent, and includes the commented-out apex block as a copy-paste target. The three subdomain site blocks (`api.<DOMAIN>`, `web.<DOMAIN>`, `admin.<DOMAIN>`) are unchanged. The `<DOMAIN>` / `<ACME_EMAIL>` placeholder convention is unchanged. |
| [`docs/Specs/Caddy-Reverse-Proxy.md` §A](../Specs/Caddy-Reverse-Proxy.md) | Updated the "Apex" section: the old text claimed the block "kikerül a Caddy-ból — sosem fut le" (a hope, not reality). The new text states the block is removed from the template and describes the two-step process (DNS A-record change + uncomment the block) that would be needed to migrate the apex. The "Utolsó frissítés" header at the top of the spec was extended with a new dated entry pointing at the new history file, per the specs-maintenance rule. |
| [`docs/history/2026-10-12--10-52-00-caddyfile-apex-block-removed.md`](../history/2026-10-12--10-52-00-caddyfile-apex-block-removed.md) | New day-to-day narrative (the five-step debug walk-through, all three probe outputs, the user-confirmation exchange, the before/after verification commands). |
| `infra/caddy/Caddyfile.rendered` | **Not committed** (gitignored). The next `deploy.yml` run will re-render the template and SCP the new file to the droplet. |
| `deploy/deploy.sh:render_caddyfile()`, `.github/workflows/deploy.yml:Render Caddyfile` | **Unchanged.** Their `sed` substitution still runs; it just no longer has an apex block to substitute. |

No source code, compose, or Caddy service config was changed.

## 5. Outcome and how to verify

The change is live in the working tree but the running Caddy container on
the droplet still has the old rendered file. The next `deploy.yml` run
(automatic on push to `dev`, or manual via `workflow_dispatch`) will ship
the new template + rendered file, then
`docker compose up -d --force-recreate caddy` will mount the new file at
`/etc/caddy/Caddyfile` and restart the caddy container. Caddy will then
attempt ACME only for the three subdomains; the apex ACME flow is gone.

To verify before and after the next deploy, from the droplet:

```bash
# 1. The live rendered file no longer mentions the apex as a site address.
docker compose --env-file infra/.env -f infra/docker-compose.yml \
  exec -T caddy cat /etc/caddy/Caddyfile \
  | grep -E '^[a-z]+\.aisztens\.hu' || true
# Before: api.aisztens.hu, web.aisztens.hu, admin.aisztens.hu, aisztens.hu
# After:  api.aisztens.hu, web.aisztens.hu, admin.aisztens.hu

# 2. No new ACME attempts for the apex.
docker compose --env-file infra/.env -f infra/docker-compose.yml \
  logs --no-color --tail=400 caddy \
  | grep -E 'identifier:"aisztens\.hu"' || echo "no apex ACME attempts"
# After:  "no apex ACME attempts"

# 3. The three subdomains still serve.
curl -fsS -o /dev/null -w '%{http_code}\n' https://api.aisztens.hu/healthz
curl -fsS -o /dev/null -w '%{http_code}\n' https://web.aisztens.hu/
curl -fsS -o /dev/null -w '%{http_code}\n' https://admin.aisztens.hu/
# Expected: 200, 200, 200 (unchanged).

# 4. The smoke step goes 12/12 green (or 11/12 + 1 skipped
#    if DOMAIN is missing from infra/.env on the droplet).
cd /opt/aisztens && bash scripts/test/stack-smoke.sh
# Expected: 12/12 checks passed
```

The previous ACME rate-limit pressure on Let's Encrypt and ZeroSSL for
`aisztens.hu` also stops with this change.

## 6. Follow-ups

- If the apex is ever migrated to this droplet, the operator must do
  both: (1) change the `aisztens.hu` A record at the registrar to
  `164.92.248.194`, and (2) uncomment the apex block in
  [`infra/caddy/Caddyfile`](../infra/caddy/Caddyfile) (it is preserved
  verbatim in the file's closing comment, as a copy-paste target). The
  deploy workflow will re-render and ship on the next push.
- Node 20 deprecation warning at the end of the `deploy.yml` log
  (`actions/checkout@v4` being forced to Node 24 by the runner) is
  cosmetic and unrelated; track separately.
- The `infra/.env.example` template still documents the older CORS list
  including `https://api.aisztens.hu`. The actual `infra/.env.dev` is
  correct (web+admin only); the template drift is harmless and can be
  cleaned up as a doc-only PR later.
