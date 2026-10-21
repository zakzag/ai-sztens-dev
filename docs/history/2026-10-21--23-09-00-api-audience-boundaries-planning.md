# 2026-10-21 23:09 — API audience boundaries: plan + Jira breakdown

## What was asked

Design a way to route the admin, the future public callback API and the mail-organizer endpoints
through **separate modules/controllers**, because their authentication/authorization differ — and
then produce a plan plus the Jira tickets.

## Answer in one line

Yes — but split by **audience (trust boundary)**, not by feature: one controller + guard per
audience, one shared domain service. Duplicating services per audience would fork the invariants.

## Artefacts

| # | Artefact | Content |
|---|---|---|
| 1 | [`docs/plans/2026-10-21--23-07-00-api-audience-boundaries-plan.md`](../plans/2026-10-21--23-07-00-api-audience-boundaries-plan.md:1) | verified starting state, audience table, target layout, fail-closed guard sketch, decisions D1–D12, six phases with file lists and DoDs, verification, risks, docs obligations |
| 2 | Jira **AIS-70** (Story) | goal, current risk, target model, key decisions, story-level DoD and test expectations |
| 3 | Jira **AIS-71 … AIS-76** (subtasks) | P0 audience plumbing · P1 `/api/admin/api-keys` · P2 admin auth backend · P3 admin SPA session · P4 API-key hashing · P5 public namespace + `X-API-Key` |

## Key decisions (full rationale in the plan)

1. **Audience prefix in the URL** (`/api/admin/*`, `/api/public/v1/*`, unchanged `/api/vapi/webhooks/*`,
   `/healthz`) — the guard becomes one metadata lookup, and the edge (Caddy/nginx) can enforce the
   same rule.
2. **Fail-closed `@Audience()` + `APP_GUARD`** — a route without metadata must not be served at all,
   so a forgotten decorator cannot silently publish an endpoint (that is exactly today's exposure of
   `GET /api/api-keys`, which returns stored tokens unauthenticated).
3. **Admin auth = httpOnly cookie, same-origin** (`SameSite=Strict`, `Secure`, `Origin` check on
   non-GET). The same-origin path already exists in Caddy (`admin.<DOMAIN>` → `/api/*` → api), and
   dev is same-origin too thanks to the Vite proxy. Rejected: Bearer token in `sessionStorage`
   (XSS-readable, and it is what the placeholder does today).
4. **Public API = `X-API-Key: <identifier>.<secret>`** validated against `platform.api_keys` —
   which forces **API-key hashing + show-once** (P4) before the guard (P5) can exist.
5. **Vapi webhook paths do not move** in this story: a move needs a Caddy `@vapi_match` change *and*
   a Vapi dashboard callback-URL change. Only the `@Audience('webhook')` metadata is added.
6. Public API is **versioned** (`/v1`), the admin API is not (the SPA ships with the API).

## Verification

Documentation + Jira only; no code changed. Checked that the plan references existing files and
that the ticket keys are the ones actually created (`AIS-70` … `AIS-76`).

## Follow-ups / notes

* **P1 must ship together with P2**: moving `api-keys` to `/api/admin/api-keys` does not by itself
  authenticate — the 401 only exists after P2. Both subtasks say so explicitly.
* The webhook path move (and the mail-organizer endpoints) are intentionally out of scope here; they
  consume this layer once it exists.
* A milestone document is due with the **implementation** (as with AIS-41), not with this planning
  step; the decision core lives in the plan.
* Sequence: `AIS-71 → (AIS-72 ∥ AIS-73) → AIS-74`, and `AIS-75 → AIS-76`.
