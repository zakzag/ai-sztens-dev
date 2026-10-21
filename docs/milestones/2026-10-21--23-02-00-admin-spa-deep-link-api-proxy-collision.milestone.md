# Milestone — SPA deep link swallowed by the `/api` dev proxy

**Date:** 2026-10-21 23:02
**Scope:** `apps/admin` (and `apps/web`) Vite dev server
**Symptom:** `http://localhost:5174/api-keys` answered `{"message":"Cannot GET /api-keys","statusCode":404}`

## 1. Problem

The AIS-41 page worked when reached by client-side navigation but not when reloaded: the browser got
the NestJS 404 payload instead of the SPA shell, so the route was unusable as a bookmark or after F5.

## 2. Measured data / evidence

| Request | Response |
|---|---|
| `:5174/` | `200 text/html` |
| `:5174/api-keys` | `404`, JSON `Cannot GET /api-keys` |
| `:3000/api-keys` | `404`, **identical** JSON → origin is the API |
| `:5174/api/api-keys` | `200 application/json` + the stored row |

## 3. Root cause

`server.proxy` in [`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:16) used the plain
key `'/api'`. Vite treats a key without a leading `^` as a **prefix** match, so `/api-keys` — a
client-side route — was forwarded to the API as `/api-keys`, a path the API does not serve (its
route is `/api/api-keys`). The proxy answered before Vite's SPA fallback could return `index.html`.
Production never had the bug: Caddy uses `handle /api/*` and nginx `try_files … /index.html`, both
requiring the trailing slash.

## 4. Solution

| File | Change |
|---|---|
| [`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:16) | proxy key `'/api'` → regex `'^/api/'` + comment explaining the prefix trap |
| [`apps/web/vite.config.ts`](../../apps/web/vite.config.ts:16) | same one-line fix (identical latent bug, the two configs are meant to mirror each other) |
| [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:202) | new §8.1 with the deep-link check and the invariant "no SPA route may collide with the API base path prefix" |
| [`docs/Specs/Local-Development.md`](../../docs/Specs/Local-Development.md:320) | §5 pitfall entry |

Rejected alternatives: renaming the route to `/keys` (leaves the loose proxy in place), pointing
`VITE_API_BASE_URL` straight at `localhost:3000/api` (per-machine env file, loses the no-CORS dev
property), a separate `/backend` namespace with a rewrite (more moving parts for the same result).

## 5. Outcome and how to verify

```bash
curl -s -o NUL -w "%{http_code} %{content_type}\n" http://localhost:5174/api-keys
#   200 text/html
curl -s -o NUL -w "%{http_code} %{content_type}\n" http://localhost:5174/api/api-keys
#   200 application/json
```

Confirmed on 2026-10-21 23:02 against the running dev server (Vite reloads its config by itself).
Manual: open `http://localhost:5174/api-keys` directly and reload — the table and the form must
render, and the network tab must show one `GET /api/api-keys`.

## 6. Follow-ups

* No automated guard exists for the proxy config; the check lives in the doc only. A tiny vitest
  test asserting the proxy key starts with `^` would prevent a regression.
* If another SPA is added, copy the regex key form, not the old prefix form.
