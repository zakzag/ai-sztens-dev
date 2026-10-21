# AIS-40 — API-keys write path: error mapping, wire contract, DI seam

**Date:** 2026-10-21
**Ticket:** AIS-40 (parent AIS-30) · **Scope:** `apps/api/src/api-keys/`, `test/api-keys.e2e-spec.ts`
**Related:** [`history/2026-10-21--18-55-00-ais-40-api-keys-backend.md`](../history/2026-10-21--18-55-00-ais-40-api-keys-backend.md), [`plans/2026-10-21--18-25-00-ais-40-api-keys-backend-plan.md`](../plans/2026-10-21--18-25-00-ais-40-api-keys-backend-plan.md)

## 1. Problem / feature

The story needed the first HTTP surface on top of `platform.api_keys`: list,
lookup by identifier, and create with validation and duplicate rejection
(`201` / `200` / `404` / `409` / `400`), including unit tests and an e2e suite.
It is also the reference persistence pattern for the next Nest resources
(AIS-19…AIS-22) and the backend contract AIS-41 (admin page) and AIS-58
(shared Zod schema) consume.

## 2. Evidence

First live round trip (real API + real Postgres) with the unit-tested classifier:

```text
duplicate=500
[ExceptionsHandler] DrizzleQueryError: Failed query: insert into "platform"."api_keys" …
  cause: PostgresError { code: '23505', constraint_name: 'api_keys_identifier_key',
                         detail: 'Key (identifier)=(smoke-vapi) already exists.' }
```

All 189 unit tests passed at that moment, i.e. the mocks were faithful to the
*database* but not to the *driver*.

## 3. Root cause / design rationale

Two mismatches between the assumed and the real error shape:

| Assumption in the first version | Reality |
|---|---|
| `error.code === '23505'` on the caught value | Drizzle wraps it: the SQLSTATE lives on `error.cause` |
| the constraint name is on `error.constraint` | `postgres.js` uses `error.constraint_name` |

The classifier therefore never matched, the error fell through to the default
handler, and the client got 500. Message-text matching would have hidden the bug
(and is rejected for locale/version reasons) — hence the fix targets the
structured chain only, with a depth limit so a self-referencing `cause` cannot
loop.

Design decisions kept from the plan: the repository returns rows/`null` and
raises no HTTP exceptions; the service translates `ApiKeyIdentifierConflictError`
→ `ConflictException` (409) and `null` → `NotFoundException` (404); the mapper
owns `Date → ISO 8601` and “omitted → `null`”; the repository sits behind
`API_KEYS_REPOSITORY` so the service has no Drizzle knowledge.

## 4. Solution — changed files

| File | Change |
|---|---|
| [`api-keys.error-guard.ts`](../../apps/api/src/api-keys/api-keys.error-guard.ts) | walks up to 5 `cause` levels; reads `constraint_name` **or** `constraint`; `23505` without a name still counts |
| [`api-keys.repository.ts`](../../apps/api/src/api-keys/api-keys.repository.ts) | uses the guard; `created_at DESC`; blank identifier short-circuits to `null` without a query |
| [`api-keys.service.ts`](../../apps/api/src/api-keys/api-keys.service.ts) / [`api-keys.controller.ts`](../../apps/api/src/api-keys/api-keys.controller.ts) | 404/409 translation, three routes, `POST` → 201 |
| [`api-keys.mapper.ts`](../../apps/api/src/api-keys/api-keys.mapper.ts) | pure row ↔ wire mapping, ISO timestamps, explicit `null`s |
| [`api-keys.module.ts`](../../apps/api/src/api-keys/api-keys.module.ts) + [`app.module.ts`](../../apps/api/src/app.module.ts) | token-bound repository, explicit `DatabaseModule` import, module registered |
| [`dto/create-api-key.dto.ts`](../../apps/api/src/api-keys/dto/create-api-key.dto.ts) | class-validator rules; `forbidNonWhitelisted` blocks `id`/`createdAt`/`updatedAt` |
| [`api-keys/test/mocks/database.mock.ts`](../../apps/api/src/api-keys/test/mocks/database.mock.ts) | chainable `insert/select` mock + `PostgresErrorMock` + `wrapDrizzleQueryError()` |
| [`error-guard.spec.ts`](../../apps/api/src/api-keys/api-keys.error-guard.spec.ts), [`repository.spec.ts`](../../apps/api/src/api-keys/api-keys.repository.spec.ts) | wrapped/chain/constraint-name cases |
| `test/api-keys.e2e-spec.ts` | real `AppModule` + real DB, unique `e2e-<uuid>`, self-cleaning |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) | §9: `platform.api_keys` now has an API consumer; unauthenticated + no-pagination limitations |

## 5. Outcome and how to verify

End state: `201` create (row persisted), `200` list/lookup, `404` unknown,
`409` duplicate, `400` invalid. 194 unit tests, 5 e2e suites, lint clean.

```bash
pnpm --filter @callback/api build
pnpm --filter @callback/api test           # 19 suites / 194 tests
pnpm --dir apps/api exec eslint src/api-keys
```

Manual check (DB-only stack up; `DATABASE_URL` exported or resolvable):

```bash
pnpm --filter @callback/api start
curl -s -X POST localhost:3000/api/api-keys -H 'content-type: application/json' \
  -d '{"name":"Vapi","identifier":"vapi-prod","apiKey":"tok_123"}'
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/api-keys \
  -H 'content-type: application/json' -d '{"name":"dup","identifier":"vapi-prod","apiKey":"x"}'   # 409
docker exec infra-postgres-1 psql -U aisztens -d aisztens_db -c \
  "SELECT identifier, expires_at FROM platform.api_keys ORDER BY created_at DESC"
```

## 6. Follow-ups

- **Auth on these routes** — they return the stored token; no public exposure before the admin-auth story.
- **Masking / rotation** — deliberately out of scope; the list returns `api_key` verbatim.
- **e2e on Node < 24.9** — `test/api-keys.e2e-spec.ts` self-skips (CommonJS `@nestjs/config` under Jest ESM); moving CI/dev to Node ≥ 24.9 makes it run unskipped.
- **AIS-58** can now add `apiKeySchema` in `@callback/shared` against the shape proven above (`expiresAt`/`description` are `null`, timestamps are ISO strings).
