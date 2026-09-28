# 2026-09-25 — Caddyfile env-var substitution fix

> **⚠ SUPERSEDED 2026-09-28.** The conclusion below — that Caddy supports
> `{env.VAR}` in site addresses — is **wrong**. Caddy only resolves
> `{env.VAR}` inside certain *module directives* (e.g. `root`, `header`,
> `rewrite`); in *site addresses* (the line right after the global options
> block) it is treated as a literal string. The single-subdomain config
> worked by accident because the broken hostname `api.{env.DOMAIN}` happens
> to be rejected by ACME in a way that did not crash Caddy outright; when
> the admin subdomain was added in
> [`2026-09-25-three-subdomain-routing-impl.md`](2026-09-25-three-subdomain-routing-impl.md)
> the resulting `admin.{env.DOMAIN}` host name started causing the Caddy
> container to crash-loop with
> `Error: adapting config using caddyfile: subject does not qualify for
> certificate: 'admin.{env.DOMAIN}'`, manifesting as high `kswapd0` CPU and
> unresponsive droplet.
>
> The correct fix is the template-render approach in
> [`2026-09-26-container-mem-limits-impl.md`](2026-09-26-container-mem-limits-impl.md):
> keep the template `infra/caddy/Caddyfile` with `<DOMAIN>` / `<ACME_EMAIL>`
> tokens, render it on every deploy into `infra/caddy/Caddyfile.rendered`
> via `deploy/deploy.sh:render_caddyfile()`, and mount the rendered file
> into the Caddy container.
>
> The text below is preserved for historical context.

## Problem

After the first successful `./deploy/deploy.sh up`, all containers were up and
healthy, but external HTTPS requests never reached the API. Symptom in the
browser:

```
Hmmm… can't reach this page
api.aisztens.hu took too long to respond
ERR_CONNECTION_TIMED_OUT
```

A second symptom showed the actual root cause once the wrong port was ruled
out (Caddy only publishes `:80` / `:443` on the host; the `:3000` in the URL
was a red herring):

```
$ curl -v https://api.aisztens.hu/api
TLSv1.3 (IN), TLS alert, internal error (592)
curl: (35) error:0A000438:SSL routines::tlsv1 alert internal error
```

TLS reached Caddy, but Caddy aborted the handshake during SNI / certificate
selection with `internal error`.

## Root cause

`infra/caddy/Caddyfile` used `{$DOMAIN}` / `{$ACME_EMAIL}` placeholder syntax.
In Caddy, that syntax is for **placeholders defined inside a `{}` block** —
not for reading environment variables. In site addresses (the line right
after the `{}` global options block) Caddy instead supports the
`{env.VAR}` placeholder, which reads the variable from the process
environment.

As a result, on the droplet the rendered Caddyfile contained a literal site
address `api.{$DOMAIN}` (with a `$` in it). Caddy could not match the SNI
name `api.aisztens.hu` to any configured site, so it returned
`tlsv1 alert internal error` during the handshake. From the browser this
looked like a connection timeout because no HTTP response ever came back.

## Fix

`infra/caddy/Caddyfile` was rewritten to use Caddy’s native env-var
placeholders:

| Before (broken) | After (fixed) |
|---|---|
| `email {$ACME_EMAIL}` | `email {env.ACME_EMAIL}` |
| `api.{$DOMAIN} { … }` | `api.{env.DOMAIN} { … }` |
| `{$DOMAIN} { … }` | `{env.DOMAIN} { … }` |
| `redir https://api.{$DOMAIN} 307` | `redir https://api.{env.DOMAIN} 307` |

The values are still supplied by `infra/docker-compose.yml` (`environment:
DOMAIN: ${DOMAIN}` / `ACME_EMAIL: ${ACME_EMAIL}` for the `caddy` service) and
ultimately by `infra/.env` on the droplet.

The admin site block (`admin.{env.DOMAIN}`) is intentionally **left
commented out** in this change — it will be enabled in a follow-up once
`apps/admin/dist` is built and mounted into the `caddy` container.

A short comment was added to the file warning future contributors about the
`{$VAR}` vs `{env.VAR}` distinction so this regression does not return.

## Verification

After running `./deploy/deploy.sh up` on the droplet:

1. `docker compose exec caddy cat /etc/caddy/Caddyfile` must show the literal
   hostnames `api.aisztens.hu` and `aisztens.hu` (no `{$DOMAIN}` left over).
2. `curl -v https://api.aisztens.hu/api` must complete the TLS handshake and
   return a 2xx JSON response from the NestJS `AppController`.
3. `docker compose logs caddy` must show Let’s Encrypt issuing certificates
   for `api.aisztens.hu` and `aisztens.hu` (look for lines containing
   `obtained certificate` or `renewing certificate`).

## Deferred (not in this change)

- **Admin subdomain** — the commented-out `admin.{env.DOMAIN}` block in
  `infra/caddy/Caddyfile` will be enabled together with mounting
  `apps/admin/dist` into the `caddy` container, once the admin SPA is
  actually built.
- **Monitor container restart loop** — `callback-assistant-monitor-1` is in
  `Restarting (255)` according to `docker compose ps`. Likely cause is
  `infra/monitor/watch.sh` exiting non-zero on a transient curl failure (the
  watchdog has no retry-and-keep-going loop). To be investigated
  separately — not blocking the API fix.