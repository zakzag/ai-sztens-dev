# AIS-112 — Shared format schemas and bilingual validation copy

**Date:** 2026-11-04
**Ticket:** AIS-112 (sub-task of AIS-103)
**Plan:** [`docs/plans/2026-11-04--00-45-00-ais-112-shared-format-schemas-and-hungarian-zod-messages-plan.md`](../plans/2026-11-04--00-45-00-ais-112-shared-format-schemas-and-hungarian-zod-messages-plan.md)
**History:** [`docs/history/2026-11-04--13-53-00-ais-112-shared-format-schemas-and-bilingual-validation-copy.md`](../history/2026-11-04--13-53-00-ais-112-shared-format-schemas-and-bilingual-validation-copy.md)

## 1. Problem / feature

Format validation (e-mail, phone, Hungarian tax number, IBAN, postal code, calendar date) was
either missing or restated per form, and the admin rendered English developer text. The story
asked for one place for the rules **and** Hungarian messages for users — while keeping the API's
`details[].message` English, because that field is developer-facing
([`docs/Specs/API-Convention.md`](../Specs/API-Convention.md:83)).

## 2. Measured data / evidence

- `packages/shared/src/contract/common/` did not exist; `packages/shared/src/contract/` held only
  `datetime.schema.ts` and the envelope/resource schemas.
- `apps/admin/src/pages/api-keys/api-keys.logic.ts` re-typed every limit and the identifier
  pattern, and `api-keys.const.ts` held eight hand-written Hungarian strings
  (`API_KEY_FORM_VALIDATION_MESSAGES`) — a second source of truth for the same rules.
- `createApiKeySchema` accepted `'   '` as a `name` (no trimming), so whitespace-only input
  reached the database.
- `pnpm test` after the change: `@callback/shared` **22 suites / 335 tests**, `@callback/admin`
  **267 tests**, all green.

## 3. Root cause / design rationale

*zod resolves a message when the schema is **built** if the message is a plain string.* A schema
used by both the API (English) and the SPA (Hungarian) therefore cannot carry a literal — and a
global `z.setErrorMap` inside `@callback/shared` would silently change every schema of the
importing process, including the API's.

Decision: one rule set, two languages, resolved **at parse time**.

| Option | Verdict |
| ------ | ------- |
| Two schemas (request + form) with different messages | rejected — the duplication the story removes |
| `z.setErrorMap` in shared module scope | rejected — global mutation leaks into `apps/api` |
| Locale-aware catalogue + `resolveMessage()` inside `superRefine` + exported `VALIDATION_ERROR_MAP` | **chosen** |
| Hand-rolled E.164 normalisation | rejected — `libphonenumber-js` knows the numbering plan |
| `iban` package | rejected — ~15 lines of mod-97, no supply-chain surface |

## 4. Solution / implementation

New in `packages/shared/src/contract/common/`:

| File | Change |
| ---- | ------ |
| `format.const.ts` | all limits, patterns, URL protocol whitelist, IBAN/tax-number constants |
| `validation-message.interface.ts` | `ValidationLocale`, `ValidationMessageKey`, catalogue types |
| `validation-message.const.ts` | the single `en` + `hu` catalogue (total record — a missing key does not compile) |
| `validation-message.helper.ts` | `resolveMessage`, `formatMessage`, `configureValidationLocale`, `reset/get` |
| `validation-error-map.logic.ts` / `.const.ts` | `VALIDATION_ERROR_MAP`: zod-generated issues → active locale |
| `format-check.helper.ts`, `format-schema.interface.ts` | parse-time issue helpers + factory options |
| `text.schema.ts` | `trimmedStringSchema`, `nonEmptyTextSchema`, `identifierSchema` |
| `email.schema.ts`, `url.schema.ts` | trim + lower-case e-mail; `http(s)` only |
| `phone.helper.ts` / `.schema.ts` | `libphonenumber-js` (HU default) → E.164 via transform |
| `hu-tax-number.helper.ts` / `.schema.ts` | check digit `(10 − Σdᵢwᵢ mod 10) mod 10`, `w=[9,7,3,1,9,7,3]`, VAT/area ranges |
| `hu-postal-code.schema.ts` | exactly four digits (range deliberately unchecked) |
| `iban.helper.ts` / `.schema.ts` | normalise + iterative mod-97 (no `BigInt`) |
| `date-only.helper.ts` / `.schema.ts` | `YYYY-MM-DD` **and** a real calendar day |
| `packages/shared/src/lib/date-only.ts` | calendar day ⇄ ISO instant, local midnight (moved from admin) |

Consumers: `createApiKeySchema` rebuilt on the text factories (trimming, `D6`);
`apps/admin/src/pages/api-keys/api-keys.logic.ts` now derives its form schema with
`.omit().extend()`; `ApiKeyForm` passes `{ errorMap: VALIDATION_ERROR_MAP }` to `zodResolver`;
`apps/admin/src/main.tsx` calls `configureValidationLocale('hu')`; the test setup does the same;
`apps/admin/src/lib/date.ts` delegates to the shared converter.

## 5. Outcome and how to verify

The rules live once, the browser speaks Hungarian, the API stays English, and one new key in the
catalogue forces both translations.

```powershell
pnpm --filter @callback/shared build
pnpm --filter @callback/shared test        # expect 22 suites / 335 tests
pnpm --filter @callback/admin test         # expect 267 tests
pnpm --filter @callback/admin build
pnpm --filter @callback/api test
pnpm quality
```

Proof of the language rule: `test/validation-error-map.test.ts` asserts that the **default** locale
is `en` (so `details[].message` stays English) and that `configureValidationLocale('hu')` changes
both the map output and the schema-supplied copy.

## 6. Follow-ups

- The `apps/api` `ConflictAppError` still uses a hand-written English detail string; unifying it
  into the catalogue is a small, separate ticket.
- `expiresAt` uses a calendar day in the form and an instant on the wire; `dateOnlySchema` closes
  the shape half, a future `DatePicker` primitive (AIS-113) can reuse the same helper.
- `phoneSchema` is not yet used by any screen, so `libphonenumber-js` is tree-shaken out of the
  current bundle; the cost appears only when a form imports it.
