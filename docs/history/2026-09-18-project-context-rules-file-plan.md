# Plan: Fill `.roo/rules/project-context.md`

- Date: 2026-09-18
- Status: Done
- Scope: Write a short, accurate project description into the project rules file used by Zoo (Code mode), so every future task starts with correct project knowledge.

## 1. Goal

[`.roo/rules/project-context.md`](../../.roo/rules/project-context.md) was an empty skeleton
(only `# Project context` and a `## U` heading). It is injected as a rule into every assistant
session, so it must contain a compact but complete picture of the project: what it is, the
architecture, the repository layout, the data flow, the current state and the conventions.

## 2. Sources Used

| Source | What was taken from it |
|---|---|
| [`README.md`](../../README.md) | Purpose, monorepo layout, prerequisites, scripts, frontend/backend wiring, current state, open items |
| [`docs/01-callback-assistant.md`](../../docs/01-callback-assistant.md) | Architecture decision, components, sequence flow, call lifecycle state machine, error handling, action engine |
| [`docs/Specs/Functional-Specification.md`](../../docs/Specs/Functional-Specification.md) | Functional spec role (single source of truth for WHAT, `MVP?` + priority columns) |
| [`docs/history/2026-09-16-documentation-structure-plan.md`](2026-09-16-documentation-structure-plan.md) | Documentation chain and plan storage convention |
| [`package.json`](../../package.json) | Workspace names (`@callback/*`) and root scripts |
| [`packages/shared/src/schemas/callback-request.schema.ts`](../../packages/shared/src/schemas/callback-request.schema.ts) | Shared Zod contract (Hungarian messages, code in English) |

## 3. Content Structure of the Filled File

1. **What this project is** — automated call-back system + key principle (providers are
   executors, backend is the decision maker).
2. **Architecture at a glance** — table of decisions: VAPI behind `CallProvider`, NestJS +
   Fastify, React + Vite clients, shared package, two queues, `Action` + `ActionRegistry`.
3. **Repository layout** — pnpm workspace tree of `apps/*`, `packages/shared`, `deploy/`,
   `infra/`, `scripts/`, `docs/`.
4. **Data flow** — the four numbered steps plus the call lifecycle states and the
   correlation-id / always-terminal-state rule.
5. **Current state** — in-memory store vertical slice, form validation, admin scaffold.
6. **Not implemented yet / open items** — persistence, auth, queues, VAPI, idempotency,
   working hours, GDPR, observability, security.
7. **Conventions** — scripts, `/api` prefix + Vite proxy, Hungarian user-facing text vs.
   English code/docs, Node >= 20, `.env` per app.
8. **Documentation map** — links to the technical docs, specs and `docs/history/`.
9. **Definition of done** — SOLID/clean code, strict TypeScript, explicit error handling,
   tests for happy path + error + edge cases, docs updated with behaviour changes.

## 4. Verification

- Content was derived only from existing repository artifacts (no invented tooling or
  decisions).
- Paths are relative to the repository root so the links resolve when the rule file is
  rendered from `.roo/rules/`.
- No code behaviour changed; this is a documentation-only change.

## 5. Follow-ups (optional)

- Extend the file with a real database choice and queue technology once
  persistence/queue work lands.
- Refresh the "Current state" section whenever a vertical slice moves from scaffold to
  implemented.
