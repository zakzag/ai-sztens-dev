# 2026-10-28 11:48 — AIS-89 completed: registry fields, client path derivation, compile-time gate

## What was asked

Continue the AIS-89 implementation. Five DoD items existed; three were already in
place (three `api-keys` entries, unique namespaced `operationId`s, green
`shared` build/test), two were open:

* the `packages/api-client` path constant was still a hand-written `'/api-keys'`
  literal — the third place where the route was spelled out;
* the `@ts-expect-error` proof that a broken registry entry fails the build was
  missing, together with the `tag` / `errors` fields from the ticket's data model.

## What was implemented

| Area | Change |
|---|---|
| Prefix single-sourcing | New `packages/shared/src/contract/api-prefix.const.ts` with `API_GLOBAL_PREFIX` (`api`) and `API_PATH_PREFIX` (`/api`); `apps/api/src/main.ts` now calls `setGlobalPrefix(API_GLOBAL_PREFIX)` |
| Registry model | `ApiEndpointContract` gained `tag` and `errors: readonly ApiErrorCode[]`; every `api-keys` entry declares its OpenAPI tag and the codes it can answer with (catalogue values only) |
| Client derivation | New `packages/api-client/src/endpoint-path.ts`: pure `toClientPath()` + `clientPathOf()` with `UnknownEndpointPathError`/`InvalidEndpointPathError`; `API_KEYS_PATH` is now `clientPathOf('apiKeys.list')` |
| Tests (shared) | `endpoint-registry.test.ts` extended: `<resource>.<action>` id shape, tag = `operationId` namespace, catalogue-only and duplicate-free `errors`, every `dataSchema` parses a realistic payload through `successEnvelopeSchema()`, no exempt route registered as enveloped, and a `@ts-expect-error` gate on a misspelled `method` |
| Tests (client) | New `packages/api-client/test/endpoint-path.test.ts`: prefix stripping, `:identifier` preserved, `/apifoo/x` and relative paths rejected, unknown `operationId` rejected, every registered endpoint convertible |
| Docs | [`docs/Specs/API-Convention.md`](../Specs/API-Convention.md) — new §1.1 describing the registry fields, the recipe and the enforcement table updated |

## Verification

```bash
pnpm --filter @callback/shared build      # green
pnpm --filter @callback/shared test       # 99 passed (was 93)
pnpm --filter @callback/api-client test   # 49 passed (was 36)
pnpm --filter @callback/api test          # 208 passed
pnpm --filter @callback/api build         # green
pnpm --filter @callback/api lint          # green
pnpm --filter @callback/admin lint        # green
pnpm --filter @callback/admin test        # 89 passed
```

## Notes

* The `@ts-expect-error` gate is placed on a property line (`method: 'FETCH'`)
  rather than on a missing field, so a later `pnpm format` cannot move the error
  away from the directive and turn it into a spurious TS2578.
* `API_ENDPOINTS` keeps the positive `envelope: true` flag plus the separate
  `ENVELOPE_EXEMPTIONS` list instead of the ticket's `skipEnvelope?: boolean`;
  the tests assert both halves of that decision.
* `apiKeys.findByIdentifier` is registered but not yet consumed by the client
  service — the route exists on the server, the client method is not part of
  AIS-89.
