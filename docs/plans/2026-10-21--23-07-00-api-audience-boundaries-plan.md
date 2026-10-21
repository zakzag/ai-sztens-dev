# API audience boundaries — admin / public / webhook endpoints with per-audience auth

**Jira:** AIS-70 (Story) + subtasks AIS-71 … AIS-76
**Date:** 2026-10-21
**Status:** planned — not implemented
**Related:** [`docs/Specs/Functional-Specification.md`](../Specs/Functional-Specification.md:1),
[`docs/Specs/UI-Architecture.md`](../Specs/UI-Architecture.md:1),
[`docs/Specs/Caddy-Reverse-Proxy.md`](../Specs/Caddy-Reverse-Proxy.md:1),
[`docs/Specs/Database-Local.md`](../Specs/Database-Local.md:1)

---

## 1. Starting state (verified)

| Area | Fact | Evidence |
|---|---|---|
| Global prefix | one prefix `api`, `healthz` excluded | [`main.ts:38`](../../apps/api/src/main.ts:38) |
| Modules | `DatabaseModule`, `HealthModule`, `ApiKeysModule`, `VapiWebhooksModule` — no audience/радел layer | [`app.module.ts:46`](../../apps/api/src/app.module.ts:46) |
| API-key endpoints | `GET/POST /api/api-keys`, `GET /api/api-keys/:identifier`, **unauthenticated** | [`api-keys.controller.ts:12`](../../apps/api/src/api-keys/api-keys.controller.ts:12) |
| Token storage | `api_key` stored **plaintext** and returned by every read | [`api-keys.mapper.ts`](../../apps/api/src/api-keys/api-keys.mapper.ts:1), live `GET /api/api-keys` output |
| Webhooks | `POST /api/vapi/webhooks/{tool-calls,end-of-call-report}` guarded by HMAC | [`vapi-signature.guard.ts`](../../apps/api/src/vapi-webhooks/vapi-signature.guard.ts:1) |
| Admin session | placeholder token in `sessionStorage`, **no server-side verification** | [`AuthContext.tsx:24`](../../apps/admin/src/auth/AuthContext.tsx:24) |
| Admin → API | cross-origin `https://api.<domain>/api` in prod, Vite proxy in dev | [`apps/admin/.env.example:19`](../../apps/admin/.env.example:19), [`vite.config.ts:16`](../../apps/admin/vite.config.ts:16) |
| Edge | Caddy routes `api.<DOMAIN>` `/api/*` → api; `admin.<DOMAIN>` also has `/api/*` → api (same-origin path exists) | [`Caddyfile:67`](../../infra/caddy/Caddyfile:67), [`Caddyfile:95`](../../infra/caddy/Caddyfile:95) |

Consequence: there is exactly **one** trust level today. The only thing standing between the
internet and a plaintext token dump is the operator remembering not to expose the route.

## 2. Scope

**In:** audience layer (`admin` / `public` / `webhook` / `ops`), fail-closed audience guard,
`/api/admin/*` migration of `api-keys`, admin authentication (cookie session + roles),
API-key hashing + show-once, `/api/public/v1/*` namespace with `X-API-Key` guard + throttling,
client-side split in `packages/api-client`, docs.

**Out (deliberately):** microservices / separate Nest apps, OAuth/SSO providers, per-record
permissions (ABAC), moving `/api/vapi/webhooks/*` to `/api/webhooks/vapi/*` (it would require a
Caddy change **and** a Vapi dashboard callback-URL change — separate, optional ticket), the future
callback and mail-organizer domain endpoints themselves (they only consume this layer),
`/healthz` (stays an ops endpoint).

## 3. Target model

Two orthogonal axes. **Do not** duplicate business logic per audience.

| Axis | Responsibility | Location |
|---|---|---|
| **Audience (HTTP adapter)** | path prefix, guard, DTO shape, throttling, audit | one controller (+ module) per audience |
| **Domain (business logic)** | invariants, persistence, validation rules | shared services, exported by feature modules |

| Audience | Prefix | Authentication | Consumer |
|---|---|---|---|
| `admin` | `/api/admin/*` | httpOnly session cookie (same-origin) + role check | admin SPA |
| `public` | `/api/public/v1/*` | `X-API-Key: <identifier>.<secret>` against `platform.api_keys` (hashed) + rate limit | public call-back form, third parties |
| `webhook` | `/api/vapi/webhooks/*` (unchanged for now) | provider HMAC (already implemented) | Vapi, future e-mail provider |
| `ops` | `/healthz` | none, internal network only | Docker healthcheck, monitor |

Stable naming rule: **the path always carries the audience** (`admin`, `public`, `vapi`), never an
implicit "whatever is left".

### 3.1 Layout

```text
apps/api/src/
  auth/
    audience.const.ts          # AUDIENCE_KEY, Audience type, @Audience(), @NoAudience()
    audience.guard.ts          # APP_GUARD, fail-closed dispatch
    audience.decorator.spec.ts
    audience.guard.spec.ts
  api-keys/
    api-keys.module.ts         # exports ApiKeysService (domain stays here)
    api-keys.service.ts
    api-keys.repository.ts
    admin/
      api-keys.admin.controller.ts      # @Controller('admin/api-keys') @Audience('admin')
      dto/
  public/
    public.module.ts           # imports ApiKeysModule
    api-keys/
      api-keys.public.controller.ts     # @Controller('public/v1/api-keys') @Audience('public')
  vapi-webhooks/               # unchanged folder, now carries @Audience('webhook')
```

Feature modules keep their domain; audience controllers either live next to the domain (`admin/`
sub-folder, as above) or in `public/` when the audience owns the whole surface.

### 3.2 Fail-closed guard

```ts
export const AUDIENCE_KEY = 'audience';
export type Audience = 'admin' | 'public' | 'webhook';

export const Audience = (...audiences: Audience[]) =>
  SetMetadata(AUDIENCE_KEY, audiences);

// APP_GUARD, registered once in AppModule
canActivate(context: ExecutionContext): boolean | Promise<boolean> {
  const required = this.reflector.getAllAndOverride<Audience[]>(AUDIENCE_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (!required || required.length === 0) {
    // A route without an explicit audience must never be served: a forgotten
    // decorator would otherwise become a silently public endpoint.
    throw new Error(
      `Route ${context.getClass().name}.${context.getHandler().name} has no @Audience()`,
    );
  }
  return this.authenticate(required, context); // per-audience strategy below
}
```

Per-audience strategy, injected: `admin → AdminSessionGuard`, `public → ApiKeyGuard`,
`webhook → VapiSignatureGuard` (the existing one is registered per-controller today; it becomes the
`webhook` strategy, or the audience guard simply delegates to it).

`HealthController` (and only it) carries `@NoAudience()` — an explicit, greppable exception.

## 4. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Split by **audience**, not by feature; the domain services stay shared | auth/throttling/DTO shape are cross-cutting per consumer; duplicating services would fork the invariants |
| D2 | The audience is part of the **URL prefix**, one controller per audience | a single string match decides the guard, Caddy/nginx can enforce it at the edge, and the OpenAPI document groups itself |
| D3 | The audience guard is **fail-closed** (`APP_GUARD`, throws when metadata is missing) | the failure mode of a forgotten decorator must be “does not boot”, not “publicly readable” |
| D4 | Admin auth = **httpOnly session cookie, same-origin** (`admin.<DOMAIN>/api/admin/*`, dev via the Vite proxy), `SameSite=Strict`, `Secure`, plus an `Origin` allow-list check on state-changing requests | the same-origin path already exists in Caddy; a cookie never touches JS (no XSS exfiltration), and `SameSite=Strict` + Origin check removes the CSRF surface without a token-plumbing round-trip |
| D5 | Rejected alternative: `Authorization: Bearer` in `sessionStorage` | readable by any injected script, and the current placeholder already lives there — moving it out is the point. A bearer token stays acceptable for machine clients only (the public API) |
| D6 | Public API auth = `X-API-Key: <identifier>.<secret>`, secret compared against a **hash** in `platform.api_keys` | the table already models credentials (`identifier` unique, `expires_at`); hashing is a prerequisite (D7) |
| D7 | `api_key` becomes `api_key_hash` (SHA-256, hex) + the plaintext is returned **once** on create | nothing in the UI renders the token (AIS-41 D33), so the change is client-invisible; storing secrets in clear text is not acceptable once they authorize a public endpoint |
| D8 | Public endpoints are **versioned** (`/api/public/v1/...`), admin endpoints are not | `/v1` is a contract with third parties; the admin SPA ships with the API, so its own versioning would only add noise |
| D9 | Rate limiting (`@nestjs/throttler`) is attached to the `public` audience only | the admin SPA is authenticated and low-volume; anonymous endpoints are the abuse surface |
| D10 | Vapi webhook paths stay `/api/vapi/webhooks/*` for now, only the `@Audience('webhook')` metadata is added | moving them needs a Caddy `@vapi_match` edit **and** a Vapi dashboard URL change — an external dependency that must not be bundled with a routing refactor |
| D11 | `packages/api-client` keeps one package but gains one client per audience (`createAdminClient` with `credentials: 'include'`, `createPublicClient` with the `X-API-Key` header) | the transport settings differ per audience exactly like the guards do; a single client would leak cookies into public calls |
| D12 | `admin` role model: `platform.admin_users` with `role ∈ {owner, operator}`, enforced by a `@Roles()` decorator + `RolesGuard` | two roles are enough for this product; anything finer would be speculation |

## 5. Phases (= Jira subtasks)

### P0 — Audience plumbing (AIS-71)

| File | Change |
|---|---|
| `apps/api/src/auth/audience.const.ts` | new: `AUDIENCE_KEY`, `Audience` type, `@Audience()`, `@NoAudience()` |
| `apps/api/src/auth/audience.guard.ts` | new: `APP_GUARD`, fail-closed metadata resolution, strategy dispatch (initially `admin`/`public` = reject-with-501 stub until P2/P5) |
| `apps/api/src/auth/*.spec.ts` | new: metadata present/absent, unknown audience, strategy dispatch |
| `apps/api/src/app.module.ts` | register the guard via `APP_GUARD` |
| `apps/api/src/health/health.controller.ts` | `@NoAudience()` + comment |
| all existing controllers | explicit `@Audience('admin' \| 'webhook')` — **no route change yet** |

**DoD:** every route carries an explicit audience; deleting one decorator makes the app fail at
request time with a clear error; `pnpm --filter @callback/api test` green.

### P1 — `/api/admin/api-keys` (AIS-72)

| File | Change |
|---|---|
| `apps/api/src/api-keys/api-keys.const.ts` | `API_KEYS_ROUTE = 'admin/api-keys'` |
| `apps/api/src/api-keys/admin/api-keys.admin.controller.ts` | moved from `api-keys.controller.ts`, `@Audience('admin')` |
| `packages/api-client/src/api-keys/api-keys.const.ts` | `API_KEYS_PATH = '/admin/api-keys'` |
| `apps/api/test/api-keys.e2e-spec.ts` | new paths + an assertion that `/api/api-keys` is now **404** |
| `apps/admin/src/services/api-client.const.ts` | comment update (base URL still `/api`, the audience lives in the path) |
| docs | `Database-Local.md` §9, this plan, AIS-41 plan note |

**DoD:** the admin page works unchanged against `/api/admin/api-keys`; the old path returns 404;
client + e2e tests green. **Note:** this phase does not yet authenticate — it must ship with P2 or
be feature-flagged off a public network.

### P2 — Admin auth backend (AIS-73)

| File | Change |
|---|---|
| `apps/api/drizzle/0003_admin_users.sql` | `platform.admin_users` (`id`, `email` unique, `password_hash`, `role`, `is_active`, timestamps) |
| `apps/api/src/auth/admin/*` | `AdminAuthModule`, `AdminAuthService` (verify password, issue/rotate session), `AdminSessionGuard`, `RolesGuard`, `@Roles()`, `@CurrentAdmin()` |
| `apps/api/src/auth/admin/admin-session.controller.ts` | `POST /api/admin/auth/login`, `POST /api/admin/auth/logout`, `GET /api/admin/auth/me` (all `@Audience('admin')`, login `@NoAudience()`-equivalent public subset) |
| `apps/api/src/main.ts` | `@fastify/cookie` registration, cookie flags, `Origin` check for non-GET `/api/admin/*` |
| `apps/api/src/auth/admin/*.spec.ts`, `apps/api/test/admin-auth.e2e-spec.ts` | new |
| env examples | `ADMIN_SESSION_SECRET`, `ADMIN_SESSION_TTL_SECONDS` in `apps/api/.env.example` |

**DoD:** unauthenticated `GET /api/admin/api-keys` → 401; wrong password → 401 without leaking
whether the e-mail exists; login sets an httpOnly cookie; logout clears it; a role check rejects
`operator` on an owner-only route; `GET /api/admin/auth/me` returns the session identity.

### P3 — Admin SPA login integration (AIS-74)

| File | Change |
|---|---|
| `apps/admin/src/services/api-client.ts` | `createHttpClient({ baseUrl, credentials: 'include' })`, no `getToken` |
| `apps/admin/src/auth/*` | `AuthContext` backed by `GET /api/admin/auth/me` (TanStack Query), `sessionStorage` usage removed |
| `apps/admin/src/features/auth/use-*.ts` | `useSessionQuery`, `useLoginMutation`, `useLogoutMutation` |
| `apps/admin/src/pages/LoginPage.tsx` | real e-mail + password form (RHF + zod), error mapping |
| `apps/admin/src/App.tsx` | `ProtectedLayout` reacts to the 401 of the session query |
| tests | login/logout/session hook tests, login page tests, `ProtectedLayout` redirect test |

**DoD:** reload keeps the session (cookie), logout really ends it (401 afterwards), a failed login
shows a field-level error, no token is written to `sessionStorage`/`localStorage`.

### P4 — API-key hashing + show-once (AIS-75)

| File | Change |
|---|---|
| `apps/api/drizzle/0004_api_key_hash.sql` | rename `api_key` → `api_key_hash`; backfill by hashing existing rows |
| `apps/api/src/api-keys/*` | create hashes the secret, response returns the plaintext **only** on `POST`; reads never return it |
| `packages/shared/src/schemas/api-key.schema.ts` | `apiKey` removed from the read schema; `createdApiKeySchema` (with the plaintext) used by `POST` only |
| `apps/api/test/api-keys.e2e-spec.ts`, `packages/*/test` | updated |
| `docs/Specs/Database-Local.md` | column description |

**DoD:** `GET /api/admin/api-keys` no longer contains any token; `POST` returns the plaintext once;
the stored value is a hash; the admin page still renders (it never showed the token).

### P5 — Public namespace + API-key guard (AIS-76)

| File | Change |
|---|---|
| `apps/api/src/public/public.module.ts` | new module, imports `ApiKeysModule` |
| `apps/api/src/auth/api-key/api-key.guard.ts` | parses `X-API-Key`, looks up by `identifier`, hashes + constant-time compares, enforces `expires_at` and `is_active`-like semantics |
| `apps/api/src/public/api-keys/api-keys.public.controller.ts` | `GET /api/public/v1/api-keys/me` → own identifier/name/expiresAt (contract probe for clients) |
| `apps/api/src/main.ts` | `ThrottlerModule` on the `public` audience |
| `packages/api-client/src/public/*` | `createPublicClient({ apiKey })` + `publicApiKeysService.whoAmI()` |
| tests | guard unit tests (missing/malformed/unknown/expired/valid key, timing-safe compare), e2e for 401/200/429 |

**DoD:** `/api/public/v1/*` requires a valid key; invalid/expired → 401 with no detail leak;
missing header → 401; over-limit → 429; `pnpm --filter @callback/api test` + `test:e2e` green.

## 6. Verification

```bash
pnpm --filter @callback/api test
pnpm --filter @callback/api test:e2e          # needs the local Postgres + DATABASE_URL
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test
pnpm --filter @callback/admin test && pnpm --filter @callback/admin lint && pnpm --filter @callback/admin build

# audience boundary smoke (after P2/P5), from the repo root
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/admin/api-keys   # 401 without cookie
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/api-keys         # 404 (old path gone)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/public/v1/api-keys/me  # 401 without key
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/healthz              # 200 (ops, no audience)
```

## 7. Risks

| Risk | Mitigation |
|---|---|
| A route shipped without `@Audience()` | fail-closed guard (D3) + one unit test per new controller |
| P1 ships before P2 → `/api/admin/api-keys` is still unauthenticated | ship P1+P2 in the same release; the e2e suite asserts the 401 after P2 |
| Cookie auth breaks CORS in dev | the Vite proxy makes dev same-origin (`localhost:5174/api/*`), so `SameSite=Strict` works without `SameSite=None`; the `Origin` check uses the same allow-list as `CORS_ORIGINS` |
| Hashing breaks the admin page or an existing client | the UI never rendered the token (AIS-41 D33); `packages/api-client` read schema is updated in the same commit |
| Public API shipped without rate limiting | throttling is part of P5's DoD, not a follow-up |
| Caddy/Vapi webhook regression | D10 defers the path move; only metadata is added |
| Old path left alive “temporarily” | the e2e suite asserts `/api/api-keys` → 404, so a leftover alias fails the build |

## 8. Documentation obligations

| File | Content |
|---|---|
| `docs/Specs/Functional-Specification.md` | endpoint matrix with audience + auth + auth failure modes |
| `docs/Specs/UI-Architecture.md` | admin client: cookie session, no token in storage; `features/auth/` row in the state table |
| `docs/Specs/Caddy-Reverse-Proxy.md` | same-origin `/api/*` on the admin host is now a **contract**, not a safety net |
| `docs/Specs/Database-Local.md` | `admin_users`, `api_key_hash` |
| `apps/api/.env.example` | `ADMIN_SESSION_SECRET`, `ADMIN_SESSION_TTL_SECONDS` |
| `docs/history/`, `docs/milestones/` | per phase, as usual |
