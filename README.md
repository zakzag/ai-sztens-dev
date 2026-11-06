# AIsztens

**AI e-mail assistant for companies.** A company connects its mailbox (Gmail first, other
providers later); the backend ingests incoming mail, classifies and prioritises it, assembles
thread context, drafts replies in the company's writing style, and turns everything into
digests and chat notifications. **No e-mail is ever sent without explicit approval.**

Key principle: **external services are executors, the backend is the decision maker.** Every
meaningful piece of state (classification, summary, draft revision, approval, change log) is
written into our own database — Gmail, the AI provider and the chat channel are inputs and
outputs, never the source of truth.

> Living documentation: [`docs/Specs/`](docs/Specs) (current state), [`docs/plans/`](docs/plans)
> (design plans), [`docs/history/`](docs/history) (change log), [`docs/milestones/`](docs/milestones)
> (decision-grade summaries). Archived, superseded material lives in
> [`docs/Specs/outdated/`](docs/Specs/outdated).

## MVP scope

| In scope (MVP)                                                                     | Out of scope (not MVP)                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Company mailbox onboarding + backfill (Gmail only)                                 | Call-back request handling (removed, see AIS-64)             |
| Push-first ingestion (`users.watch` + Pub/Sub), polling as fallback                | VAPI voice calls, speech-to-text / text-to-speech, LLM calls |
| Five-category triage, urgency threshold, rule precedence (VIP / blocklist / topic) | Call queue, call dispatcher, webhook-driven call state       |
| Context assembly, summaries, retention windows                                     | Provider-owned webhook contracts as a product feature        |
| Reply drafting with style profile + approval-gated send                            |                                                              |
| Selective notifications, quiet hours, periodic digest                              |                                                              |
| Admin UI for mailboxes, rules, drafts, change log                                  |                                                              |

**The call-back / VAPI line is legacy, not roadmap.** The voice-call bounded context was dropped
from the MVP (AIS-64); what still exists in the repository is inert leftovers, kept only until
they are deleted:

- [`apps/api/src/vapi-webhooks/`](apps/api/src/vapi-webhooks) — an in-memory webhook receiver with
  signature verification. It is not wired to the email module and not part of any MVP flow.
- [`packages/shared/src/contract/common/phone.helper.ts`](packages/shared/src/contract/common/phone.helper.ts) —
  phone formatting shared helper, unused by the email features.

Do not extend these folders. No new feature may depend on them.

## Monorepo layout

pnpm workspace: one API plus two React clients and four shared packages.

```
apps/
  api/        NestJS + Fastify API (TypeScript, ESM, strict mode)
  web/        Public site — React + Vite (landing / legal pages only)
  admin/      Admin dashboard — React + Vite SPA + TanStack Query + Tailwind v4
packages/
  shared/       Shared contract: TS types + Zod schemas (API <-> clients)
  api-client/   HTTP client + per-domain services (the only backend access)
  ui/           Design system primitives + `@theme` tokens (neomorphism)
  notifications/ Toast / log-drawer store, React bindings
```

Architecture rules for the frontend layers are in
[`.roo/rules/react.coding-standards.md`](.roo/rules/react.coding-standards.md) and
[`docs/Specs/UI-Architecture.md`](docs/Specs/UI-Architecture.md).

## Prerequisites

- Node.js >= 24.9.0 (see `engines` in [`package.json`](package.json:6))
- pnpm — enable via Corepack (`corepack enable pnpm`) or `npm i -g pnpm`
- Docker (for the local Postgres stack and the smoke tests)

## Getting started

```bash
pnpm install     # installs all workspace packages
pnpm build       # builds packages first, then apps/api, apps/web, apps/admin
pnpm dev         # shared watcher + API (:3000) + web (:5173) + admin (:5174)
```

Database and full local stack:

```bash
pnpm db:up                 # Postgres only (infra/docker-compose.db.yml)
pnpm --filter @callback/api db:migrate
pnpm qa:all                # every gate: quality, typecheck, build, lint, tests
```

Environment variables use a per-environment layout (`.env.local` for the developer machine,
`.env.dev` for the dev droplet, `.env.prod` for the prod droplet — the bare `.env` names are
legacy). Copy the `.env.example` templates as needed:

| File                                               | Contents                                  |
| -------------------------------------------------- | ----------------------------------------- |
| `apps/api/.env.local` / `.env.dev` / `.env.prod`   | `PORT`, `CORS_ORIGINS`, `DATABASE_URL`, … |
| `apps/web/.env.local` / `.env.dev` / `.env.prod`   | `VITE_API_BASE_URL`                       |
| `apps/admin/.env.local` / `.env.dev` / `.env.prod` | `VITE_API_BASE_URL`                       |

Validate every `.env` file offline, and find the other helper scripts, in
[`scripts/README.md`](scripts/README.md).

### Useful scripts

| Command                                  | Effect                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`                               | Start all apps in watch mode (NestJS + two Vite dev servers)                |
| `pnpm build`                             | Build the whole monorepo (topological order)                                |
| `pnpm test`                              | Unit tests for every package and app                                        |
| `pnpm test:e2e`                          | API e2e tests (Fastify)                                                     |
| `pnpm typecheck`                         | Build shared, then typecheck every workspace member                         |
| `pnpm lint`                              | Lint all packages                                                           |
| `pnpm quality`                           | Layer, dead-code, token, field-error and docs gates                         |
| `pnpm db:up` / `pnpm db:down`            | Local Postgres container up / down                                          |
| [`scripts/README.md`](scripts/README.md) | Script index: local stack helper, `.env` checks, stack smoke, SSH, AI rules |

Per-package scripts run with `pnpm --filter <pkg> <script>`, e.g.
`pnpm --filter @callback/api start:dev`, `pnpm --filter @callback/api db:generate`.

## API conventions

- Every endpoint lives under the `/api` prefix and answers with the standard envelope; raw-body
  routes are listed explicitly in
  [`endpoint.registry.ts`](packages/shared/src/contract/endpoint.registry.ts:41).
- The contract is code-first: Zod schemas in `packages/shared` are the single source, and the
  machine-readable artefact is served at `/api/openapi.json`.
- Admin endpoints are protected by API keys (`/api/api-keys`); `GET /healthz` stays unenveloped
  for Docker and the monitor watchdog.
- In development each Vite dev server proxies `/api` to `http://localhost:3000`, so the browser
  never hits CORS ([`apps/web/vite.config.ts`](apps/web/vite.config.ts),
  [`apps/admin/vite.config.ts`](apps/admin/vite.config.ts)).

## Current state

- Monorepo, CI, deploy pipeline and the three-environment infrastructure are in place.
- **The email assistant is designed but not implemented yet**: the structural design
  (hexagonal ports/adapters, Gmail adapter, Pub/Sub ingestion, triage/draft/digest use cases) is
  captured in [`docs/plans/2026-10-14-email-module-structural-design-plan.md`](docs/plans/2026-10-14-email-module-structural-design-plan.md)
  and its follow-ups.
- Delivered reference slices, used as the pattern for new features:
  - **API keys** — DB-backed CRUD with envelope, list query contract, OpenAPI validation and
    integration tests (`apps/api/src/api-keys`).
  - **Admin foundation** — routing, session placeholder, API client + generic list/detail/mutation
    hooks, form pattern, error surfaces, notification system, and the API keys page.

### Next steps

- Implement the email module phases from its structural plan (Gmail adapter + onboarding first).
- Remove the leftover VAPI webhook module and the unused phone helper once nothing references them.
- Real admin authentication (JWT) replacing the session placeholder.
- Observability: structured logging, metrics, alerting; GDPR/retention enforcement in code.
