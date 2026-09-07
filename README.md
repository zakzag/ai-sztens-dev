# Callback Assistant

Automated call-back system: a website visitor requests a call-back through a form, the
backend stores and validates the request, then a call worker initiates an AI-driven phone
call, processes the results and executes configurable follow-up actions.

> Full architecture, flows and decisions: [`docs/01-callback-assistant.md`](docs/01-callback-assistant.md)
> and the other files under [`docs/`](docs).

## Monorepo Layout

pnpm workspace hosting the API plus two React clients:

```
apps/
  api/      NestJS + Fastify API (TypeScript, ESM, strict mode)
  web/      Public website — React + Vite + react-router (multi-page)
  admin/    Admin dashboard — React + Vite SPA + TanStack Query
packages/
  shared/   Shared TypeScript types + Zod schemas (API <-> clients contract)
```

## Prerequisites

- Node.js >= 20
- pnpm — enable via Corepack (`corepack enable pnpm`) or `npm i -g pnpm`

## Getting Started

```bash
pnpm install     # installs all workspace packages
pnpm build       # builds packages/shared first, then apps/api, apps/web, apps/admin
pnpm dev         # runs shared watcher + API (:3000) + web (:5173) + admin (:5174)
```

Environment variables (copy the `.env.example` files as needed):

| File | Contents |
|---|---|
| `apps/api/.env` | `PORT`, `CORS_ORIGINS` |
| `apps/web/.env` | `VITE_API_BASE_URL` |
| `apps/admin/.env` | `VITE_API_BASE_URL` |

### Useful scripts

| Command | Effect |
|---|---|
| `pnpm dev` | Start all apps with watch mode |
| `pnpm build` | Build the whole monorepo (topological order) |
| `pnpm test` | API unit tests |
| `pnpm test:e2e` | API e2e tests (Fastify) |
| `pnpm lint` | Lint all packages |

Per-package scripts are runnable with `pnpm --filter <pkg> <script>`, e.g.
`pnpm --filter @callback/api start:dev`.

## Frontend <-> Backend Connection

- All API endpoints live under the `/api` prefix (e.g. `POST /api/callback-requests`).
- In development each Vite dev server proxies `/api` to `http://localhost:3000`, so the
  browser never hits CORS (`apps/web/vite.config.ts`, `apps/admin/vite.config.ts`).
- The API enables CORS via Fastify for the configured `CORS_ORIGINS`.
- `packages/shared` holds the shared TS types and the Zod validation schema used by the
  public form; the API mirrors the contract with a validated DTO.

## Components

| Component | Responsibility |
|---|---|
| Web Frontend (`apps/web`) | Public site: landing page + call-back request form |
| Admin Dashboard (`apps/admin`) | Owner-facing view of requests/calls (scaffold) |
| Request API (`apps/api`) | Receive + validate submissions, list/store requests |
| Call Queue + Action Queue | Two separate queues (call jobs + action jobs) |
| Call Dispatcher | Consumes call queue, starts calls via the CallProvider |
| VAPI (Call Provider) | Outbound call + AI conversation; emits webhook events |
| Webhook Receiver | Receives provider events; updates status; saves call details |
| Action Executor + Registry | Runs in-call and post-call actions |
| Notification / Calendar Service | Notify owner/caller, booking proposals |

## Current State

- Monorepo scaffolding in place (API + web + admin + shared).
- The API exposes a working vertical slice: `POST /api/callback-requests` (202)
  and `GET /api/callback-requests` backed by an in-memory store.
- The web form validates with the shared Zod schema and submits to the API.
- The admin dashboard lists requests via TanStack Query (auth is a placeholder).

### Next Steps / Open Items

- Persistence (replace the in-memory request store with a database)
- Real admin authentication (JWT), queue workers, VAPI integration, webhooks
- Idempotent call initiation, dead-letter review, GDPR handling
- Observability: structured logging, metrics, alerting
- Security: rate limiting on the form, secrets management, TLS
