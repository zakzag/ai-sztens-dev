# 2026-10-28 13:37 — Quiet Nest logger output in the API unit suite

## What was reported

`pnpm test` printed a wall of `[Nest] … ERROR` lines with full stack traces
(`DatabaseLifecycleService` close failures, `ApiExceptionFilter` 500 / non-HTTP
handling) even though **all 24 suites and 212 tests passed**.

## Diagnosis

The lines were not failures — they are the _production_ log calls of the very
branches those specs exercise on purpose. Nothing was broken; the test run simply
shared the console with the application logger.

## Change

| File                                                   | Change                                                                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/test/setup/silence-nest-logger.ts` (new) | `Logger.overrideLogger(false)` installs Nest's `NoopLogger`; documented why the calls stay observable for spies                                                                                   |
| `apps/api/package.json`                                | `jest.setupFiles` → `<rootDir>/test/setup/silence-nest-logger.ts` (unit config only; the e2e config is untouched)                                                                                 |
| `apps/api/src/db/database-lifecycle.service.spec.ts`   | the two failure tests now assert the `Logger.error` call (message text + call count) instead of relying on console noise, using a local `captureLogMessages()` recorder — no spy typing, no casts |

## Verification

```bash
pnpm --filter @callback/api test    # 24 suites / 212 tests, no [Nest] ERROR lines
pnpm --filter @callback/api lint    # green
```

Remaining output is intentional: the `console.warn` notice that
`api-keys.module.spec.ts` self-skips the real-module compile on Node < 24.9.

## Notes

- A failing assertion still fails: no test asserts console text, and the logger
  interceptor sits in front of the no-op logger, so `Logger.prototype` spies keep
  working (the pattern already used in `vapi-signature.guard.spec.ts`).
- Kept the production logging untouched — silencing belongs to the test harness,
  not to `ApiExceptionFilter` or `DatabaseLifecycleService`.
