# 2026-10-28 11:35 — AIS-87: splitting the finished work into subtask commits

## What was asked

Commit the already-finished AIS-87 implementation "with the appropriate subtask" —
i.e. not as one large commit, but as one commit per Jira subtask, following the
`<KEY>: <type>(<scope>): <summary>` title convention decided in AIS-101.

## State before the split

The working tree held the whole AIS-87 body of work as a single uncommitted blob:
42 modified/deleted files plus the untracked `apps/api/src/common/` layer, the AIS-89
registry files and the documentation. Only `AIS-88` had been committed earlier
(`b452d01`), and even that left a refinement behind (strict request schema,
unconstrained envelope payload).

## What was done

The tree was split by the subtask that actually owns each file, resulting in ten
commits (oldest first):

| Commit | Subtask | Content |
|---|---|---|
| `4901757` | AIS-88 | `createApiKeySchema` is `.strict()`; `successEnvelopeSchema` payload type unconstrained |
| `1b6afca` | AIS-89 | `ApiEndpointContract`, `API_KEYS_ENDPOINTS`, `API_ENDPOINTS` + `ENVELOPE_EXEMPTIONS`, `findEndpoint`, registry exports and tests |
| `b40ad63` | AIS-90 | `AppError` hierarchy, `toAppError`, `toApiErrorDetails`, `ZodBodyPipe` / `ZodQueryPipe`, `zod` dependency |
| `484062e` | AIS-91 | `ApiResponseService`, global `ApiExceptionFilter`, `api-messages.const.ts`, status → code mapper |
| `2ab0431` | AIS-92 | `request-context.ts`, `request-id.interceptor.ts`, `HttpModule`, `@SkipEnvelope()`, envelope for `GET /` |
| `54f0c99` | AIS-93 | `api-keys` controller/service/mapper onto the envelope; class-validator DTO and local wire interface deleted |
| `3b6fba6` | AIS-94 | transport unwraps `{ data, meta }`; `ApiError` gains `code` / `requestId` / `issues[]` |
| `9cac48f` | AIS-95 | code-first `toErrorMessage()`, conflict mapped onto the `identifier` field, extended test mocks |
| `48a0ed6` | AIS-97 | e2e suites cover the envelope branches and the exempt routes (CI gate still open) |
| `d782f26` | AIS-100 | `docs/Specs/API-Convention.md`, the AIS-87 history entry, the milestone |

## Verification

Run before the first commit, on the full working tree:

```bash
pnpm --filter @callback/shared build     # green
pnpm --filter @callback/shared test      # 93 passed
pnpm --filter @callback/api-client test  # 36 passed
pnpm --filter @callback/admin test       # 89 passed
pnpm --filter @callback/api test         # 208 passed
```

The e2e suites are committed but were not executed: they self-skip on Node < 24.9
(the Jest ESM runner cannot load the CommonJS-only `@nestjs/config`).

## Notes and consequences

Intermediate commits are not individually bisectable in the strict sense: the
`apps/api/src/common/http` layer was untracked, so `AIS-90`, `AIS-91` and `AIS-92`
only compile once all three are applied. The split follows ownership, not build order.

## What did not change

No source file was touched during this task — only `git add` / `git commit` (plus this
history entry). AIS-89's client-path item remains open: `packages/api-client/src/api-keys/api-keys.const.ts`
still hard-codes `'/api-keys'` instead of deriving it from the shared registry.
