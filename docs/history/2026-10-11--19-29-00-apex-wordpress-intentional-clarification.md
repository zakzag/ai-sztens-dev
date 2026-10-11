# Clarification — apex `aisztens.hu` is intentionally a separate WordPress server

**Date:** 2026-10-11 19:29 UTC (about 3.5 hours after the bring-up)
**Files touched:**

- [`docs/Specs/Caddy-Reverse-Proxy.md`](../../docs/Specs/Caddy-Reverse-Proxy.md) — §A rewritten from "DNS is wrong" framing to "apex is intentionally a separate WordPress server". `Utolsó frissítés` line updated.
- [`docs/history/2026-10-11--19-29-00-apex-wordpress-intentional-clarification.md`](2026-10-11--19-29-00-apex-wordpress-intentional-clarification.md) — this entry.

---

## Why this entry exists

The earlier session at [2026-10-11--15-50-00](2026-10-11--15-50-00-image-based-deploy-host-up-and-hardening.md) documented §A as "apex DNS-eltérés a droplet IP-jétől" — which read as if the apex A record needed fixing. The operator clarified that the apex `aisztens.hu` is **intentionally hosted on a separate WordPress server** and is **not** part of this stack.

So §A was rewritten to make this explicit:

| Host | Who serves it |
|---|---|
| `api.aisztens.hu`, `web.aisztens.hu`, `admin.aisztens.hu` | Caddy on the droplet (`164.92.248.194`) |
| `aisztens.hu` | Separate WordPress server (`185.80.48.2`) — intentional, not a bug |
| `ssh.aisztens.hu` | OpenSSH on the droplet |

## Verified still-live (~3 hours after bring-up)

```
https://api.aisztens.hu/api                  http=200 time=0.36s
https://api.aisztens.hu/healthz              http=200 time=0.18s
https://api.aisztens.hu/api/callback-requests http=200 time=0.16s
https://web.aisztens.hu/                     http=200 time=0.18s
https://admin.aisztens.hu/                   http=200 time=0.14s
https://aisztens.hu/                         http=200 time=0.12s   (WordPress, intentional)
```

DNS crosscheck:

```
api.aisztens.hu   -> 64:ff9b::a45c:f8c2 (= 164.92.248.194, droplet)
web.aisztens.hu   -> 64:ff9b::a45c:f8c2 (droplet)
admin.aisztens.hu -> 64:ff9b::a45c:f8c2 (droplet)
aisztens.hu       -> 64:ff9b::b950:3002 (= 185.80.48.2, WordPress server)
```

The Caddyfile's `aisztens.hu { redir https://web.aisztens.hu{uri} 307 }` block never runs — the apex never reaches the droplet — but that is fine, because the apex is not our service.

## Cleanup

The `docker-compose.yml.prev-build` back-up and the `callback-assistant/*` legacy images on the droplet remain in place for the operator's manual inspection (out of scope for these sessions). No further automated cleanup.
