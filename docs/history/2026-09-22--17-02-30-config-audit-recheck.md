# Config / .env Re-audit — 2026-09-22 (second pass)

- Date: 2026-09-22
- Status: Re-audit after fixes
- Source audit: [`docs/history/2026-09-22-config-audit-findings.md`](2026-09-22-config-audit-findings.md)

## Verdict per finding

| # | Finding | Before | After | Status |
|---|---|---|---|---|
| A1 | REMOTE_DIR mismatch | `deploy/.env=/opt/aisztens` vs scripts+README=`/opt/callback` | All four files now use `/opt/aisztens` ([`deploy/.env:12`](../../deploy/.env), [`deploy/deploy.sh:29`](../../deploy/deploy.sh), [`deploy/bootstrap.sh:11,19`](../../deploy/bootstrap.sh), [`deploy/README.md:11,43`](../../deploy/README.md)) | ✅ Fixed |
| A2 | `HOST=` empty | empty | `HOST=164.92.248.194` ([`deploy/.env:8`](../../deploy/.env)) | ✅ Fixed |
| A3 | `DOMAIN=localhost` | localhost | `DOMAIN=164.92.248.184` ([`infra/.env:8`](../../infra/.env)) | ⚠️ See issue below |
| A4 | `ACME_EMAIL=ops@example.com` | placeholder | `ACME_EMAIL=aisztens@gmail.com` ([`infra/.env:9`](../../infra/.env)) | ✅ Fixed |
| B1 | `VAPI_WEBHOOK_SECRET=change-me-vapi-secret` | placeholder | `VAPI_WEBHOOK_SECRET=aisztens_real_secret_238!` ([`infra/.env:17`](../../infra/.env)) | ✅ Fixed (but see below) |
| B2 | `MONITOR_ALERT_WEBHOOK_URL` empty | empty | **still empty** ([`infra/.env:39`](../../infra/.env)) | ❌ Not fixed |
| C2 | Doc says `01-roles.sql` | wrong | **still says `01-roles.sql`** ([`docs/history/2026-09-18-droplet-deploy-infra-plan.md:41`](2026-09-18-droplet-deploy-infra-plan.md)) | ❌ Not fixed (cosmetic) |
| C3 | SSH `.pub.example` placeholders | missing | **still missing** (`deploy/ssh-keys/` only holds real `*.pub`) | ❌ Not fixed (cosmetic) |

## New issues found this pass

### N1 — IP address mismatch between `deploy/.env` and `infra/.env`

[`deploy/.env:8`](../../deploy/.env) is `164.92.248.194`, but [`infra/.env:8`](../../infra/.env) is `164.92.248.184` (last octet differs). One of them is wrong. Verify which is the actual droplet IP in the DigitalOcean dashboard and update the file that's wrong.

### N2 — `DOMAIN` set to a raw IP, not a hostname

[`infra/.env:8`](../../infra/.env) `DOMAIN=164.92.248.184` is an IPv4 literal. The Caddyfile uses `{$DOMAIN}` as both apex and `api.{$DOMAIN}` subdomain host. Let's Encrypt will not issue a certificate for a bare IP — TLS will fail. Two workable options:

1. **DNS-based (recommended)**: set `DOMAIN=aisztens.hu` and ensure `A aisztens.hu` + `A api.aisztens.hu` (and optionally `admin.aisztens.hu`, `web.aisztens.hu`) point at the droplet. Caddy then issues certs for `aisztens.hu` and `api.aisztens.hu`.
2. **IP-only first deploy (acceptable for a smoke test)**: keep `DOMAIN=:80` style isn't supported; the simplest is to remove the api subdomain block from the Caddyfile and bind 80/443 directly with `{$DOMAIN:164.92.248.184}` — but this still won't get a TLS cert.

Given the Caddyfile layout, **option 1 is the only clean path**. Switch `DOMAIN` to a hostname once DNS is configured.

### N3 — `VAPI_WEBHOOK_SECRET` is technically rotated, but weak

The new value `aisztens_real_secret_238!` is human-readable and predictable (project name + "real" + "238"). For a webhook authenticator this is fine functionally, but a cryptographically random value is the convention. If this is a shared secret between our API and the VAPI dashboard, recommend:

```bash
openssl rand -hex 32
```

…and paste the output into both `infra/.env` and the VAPI dashboard.

### N4 — Repo now contains a stray `\$null` file at the root

The latest directory listing shows a literal `$null` file in the repo root. Likely created by accident (e.g. `>` redirection from PowerShell without quotes, or accidental `$null` argument). Add `\$null` to [`.gitignore`](../../.gitignore) and remove it:

```bash
git rm '$null'
```

### N5 — `MONITOR_ALERT_WEBHOOK_URL` is still empty

Same recommendation as before: register a free Healthchecks.io probe and paste the URL into [`infra/.env:39`](../../infra/.env). Until then, the watchdog logs failures but cannot notify anyone.

### N6 — Verification command in WSL failed

You ran `docker compose --env-file infra/.env -f infra/docker-compose.yml config` inside WSL, and Docker isn't on the WSL PATH yet. Two options:

1. Activate the WSL integration in Docker Desktop (Settings → Resources → WSL integration → enable for the distro).
2. Use the WSL override `infra/docker-compose.wsl.yml` with a local PostgreSQL password and run from PowerShell where Docker Desktop is on PATH.

Or run the YAML syntax check without Docker:

```bash
# Quick compose lint using Python (no docker required):
python -c "import yaml,sys; yaml.safe_load(open('infra/docker-compose.yml')); print('ok')"
```

## Updated checklist (now)

- [x] A1 REMOTE_DIR alignment — fixed
- [x] A2 HOST filled — fixed
- [ ] A3 DOMAIN → real hostname — partially (IP instead of hostname)
- [x] A4 ACME_EMAIL real — fixed
- [ ] B1 VAPI_WEBHOOK_SECRET strong random — improved, but not random
- [ ] B2 MONITOR_ALERT_WEBHOOK_URL filled — not fixed
- [ ] C2 doc fix — not fixed
- [ ] C3 SSH key placeholders — not fixed
- [ ] N1 HOST vs DOMAIN IP mismatch — new
- [ ] N4 stray `$null` file — new

## Summary

**7 out of 10 original critical items are addressed.** Two cosmetic items (C2, C3) and one observability item (B2) remain, plus two new issues (N1 IP mismatch, N4 stray file) that surfaced after the fixes. The single most important blocker now is **N2: `DOMAIN` is an IP literal** — TLS acquisition will fail with the current Caddyfile.

Save date: 2026-09-22T15:02 UTC