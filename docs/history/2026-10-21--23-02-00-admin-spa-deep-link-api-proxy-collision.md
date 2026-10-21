# 2026-10-21 23:02 — `http://localhost:5174/api-keys` returned the API's 404

## Symptom

Reloading the AIS-41 page directly (`http://localhost:5174/api-keys`) rendered JSON instead of the
SPA:

```json
{"message":"Cannot GET /api-keys","error":"Not Found","statusCode":404}
```

## Proof of the mechanism

| Request | Result |
|---|---|
| `GET http://localhost:5174/` | `200 text/html` (SPA shell) |
| `GET http://localhost:5174/api-keys` | `404` + the JSON above |
| `GET http://localhost:3000/api-keys` | `404` + the **same** JSON → the message comes from the API |
| `GET http://localhost:5174/api/api-keys` | `200 application/json` with the stored row → the proxy path itself works |

Root cause: [`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:16) declared the dev
proxy as `proxy: { '/api': … }`. In Vite a key **without** a leading `^` is a *prefix* match, so
every path starting with `/api` was forwarded — including the client-side route `/api-keys`. The
API has no `/api-keys` route (its route is `/api/api-keys`), hence its 404. Nothing was wrong with
the page, the router or the API: the dev proxy simply answered before the SPA fallback could.

Production was never affected: Caddy matches `handle /api/*` and nginx uses
`try_files $uri $uri/ /index.html`, both of which require the trailing slash.

## Fix

[`apps/admin/vite.config.ts`](../../apps/admin/vite.config.ts:16) and
[`apps/web/vite.config.ts`](../../apps/web/vite.config.ts:16) now use the **regex** key
`'^/api/'` (a key starting with `^` is treated as a RegExp by Vite), with a comment explaining
why the prefix form is wrong.

```ts
proxy: {
  '^/api/': { target: 'http://localhost:3000', changeOrigin: true },
},
```

Verified through the running dev server (Vite restarts itself on a config change):

```
GET http://localhost:5174/api-keys      → 200 text/html          (SPA, React Router renders the page)
GET http://localhost:5174/api/api-keys  → 200 application/json   (proxy untouched)
GET http://localhost:5174/              → 200 text/html
```

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Rename the route `/api-keys` → `/keys` | Removes this collision but leaves the loose proxy in place; the next `/api*` route would break the same way. Kept as a fallback if the regex ever becomes impractical. |
| `VITE_API_BASE_URL=http://localhost:3000/api` in `apps/admin/.env.local` (bypass the proxy) | Works now that `localhost:5174` is CORS-allowed, and it mirrors production (which calls `https://api.<domain>/api`), but it trades a one-line config fix for a per-machine env file and loses the "no CORS in dev" property. |
| Separate proxy namespace (`/backend` → rewrite to `/api`) | Two moving parts (proxy rewrite + `VITE_API_BASE_URL`) for the same result as the regex. |
| Keep `'/api'`, exclude the SPA route explicitly | Vite prefix keys cannot express "everything under `/api/` but not `/api-keys`"; only the regex form can. |

## Docs updated

| File | Change |
|---|---|
| [`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:202) | new §8.1 "SPA deep link through the dev proxy" with the two verification curls and the "no SPA route may collide with the API base path prefix" invariant |
| [`docs/Specs/Local-Development.md`](../Specs/Local-Development.md:320) | §5 pitfall entry for the deep-link collision |
| [`docs/milestones/2026-10-21--23-02-00-admin-spa-deep-link-api-proxy-collision.milestone.md`](../milestones/2026-10-21--23-02-00-admin-spa-deep-link-api-proxy-collision.milestone.md) | decision-grade summary |

## Follow-ups

* Test gate: `apps/admin` has no test that touches `vite.config.ts`, so this class of bug is only
  caught by the manual deep-link curl in §8.1. A small config test (import the config, assert the
  proxy key starts with `^`) would close that gap.
* Both vite configs are now identical except for the port; if a third SPA appears, copy the regex
  form, not the old prefix form.
