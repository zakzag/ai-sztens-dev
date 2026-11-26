# AIS-178 / slice d — customer contacts and their roles

**Date:** 2026-11-23 15:42 (Europe/Budapest)
**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Plan:** [`docs/plans/2026-11-23--16-13-00-ais-178-d-customer-contacts-plan.md`](../plans/2026-11-23--16-13-00-ais-178-d-customer-contacts-plan.md)
**Gap analysis it closes:** [`2026-11-23--15-23-00-ais-14-gap-analysis.md`](./2026-11-23--15-23-00-ais-14-gap-analysis.md) item **M2**
**Commit titles:** `AIS-178: feat(api): add customer contacts and contact roles`,
`AIS-178: feat(api-client): add the customer contacts methods`

---

## Why

The `customers` detail response already published `contacts[]` with their `roles[]`, the tables and
their invariant indexes existed, and `AUDIT_TABLE_NAMES` already listed `contacts` and
`contact_roles` — but nothing could write them. Two consequences: the contact card of the detail page
was read-only by construction, and the "one `primary` contact per customer" index had no mapping, so a
second primary would have been a `500` instead of the `409` the AIS-14 DoD requires.

## What changed

| # | File | Change |
| --- | --- | --- |
| 1 | `packages/shared/src/contract/error-code.const.ts` | `CUSTOMER_PRIMARY_CONTACT_CONFLICT` (`409`) |
| 2 | `packages/shared/src/contract/customers/customers.const.ts` | `CUSTOMERS_CONTACT_ID_PARAM` |
| 3 | `packages/shared/src/contract/customers/customers.schema.ts` | `contactIdSchema` (uuid, `400` instead of `22P02`), `contactListSchema` |
| 4 | `packages/shared/src/contract/customers/customers.contract.ts` | four entries: `customers.listContacts`, `createContact`, `updateContact`, `removeContact` |
| 5 | `packages/shared/src/contract/customers/customers.fixture.ts` | `VALID_CREATE_CONTACT_REQUEST`, `VALID_UPDATE_CONTACT_REQUEST`, `VALID_CONTACT_LIST` |
| 6 | `packages/shared/src/index.ts` | exports the new schema, param, fixtures and the error code |
| 7 | `apps/api/src/common/date/iso-date.ts` | **new** — `toIsoString` / `toNullableIsoString`, now shared by the two mappers (the customer mapper imports them instead of keeping a private copy) |
| 8 | `apps/api/src/db/postgres-error.logic.ts` | `PG_FOREIGN_KEY_VIOLATION_CODE` |
| 9 | `apps/api/src/customers/customers-contacts.{const,interface,errors,error-guard,filter,mapper,repository.interface,repository,service,controller}.ts` | **new** — the whole vertical slice: scoped reads, delete-then-insert role replace, guarded update, two ledger rows per delete |
| 10 | `apps/api/src/customers/customers.module.ts` | registers the new controller, service and repository token |
| 11 | `apps/api/src/common/openapi/zod-openapi.ts` | `Contact`, `ContactList`, `CreateContact`, `UpdateContact` components |
| 12 | `apps/api/src/common/openapi/zod-openapi.spec.ts` | the component list grows by four |
| 13 | `packages/shared/test/endpoint-registry.test.ts` | the four new operations get a sample payload |
| 14 | `packages/api-client/src/customers/{customers.const,customers.path,customers.interface,customers.service}.ts` | `CUSTOMERS_CONTACTS_PATH`, `CUSTOMERS_CONTACT_PATH`, the two path builders and the four service methods |
| 15 | `packages/api-client/src/index.ts`, `test/mocks/customer.mock.ts`, `test/customers.service.test.ts` | exports, contact fixtures, thirteen contact cases |
| 16 | `apps/admin/src/lib/error-message.const.ts` + `api-error-code.const.ts` | Hungarian copy for the new code, with a field-level variant (the role picker is an input) |
| 17 | `docs/Specs/API-Convention.md` | new §12.1 (routes, the two constraint-driven answers, the roles-only PATCH note) + header date |
| 18 | `apps/api/test/customer-contacts.e2e-spec.ts` | **new** — create → list → detail-free path → `409` → stale `409` → delete → `primaryContactName` null → ledger rows |
| 19 | `apps/api/src/customers/customers-contacts.{mapper,error-guard,service,controller}.spec.ts` | **new** — 30 unit cases |

## Decisions worth carrying forward

- **Roles are part of the contact payload and are replaced as a set** (D2). That is what the shared
  schemas already published, and a replace is atomic: "move the primary flag" is one request.
- **`422` for a foreign `customerUserId`** (D5). The composite foreign key
  `contacts_customer_user_id_fkey` rejects a login user of another customer; the body is well formed,
  so `SEMANTIC_VALIDATION_FAILED` is the honest answer — and it is the first consumer of that code.
- **A delete writes two ledger rows** (D7): `contact_roles` `delete` (`recordId: null`, the removed set
  in `before`) and `contacts` `soft_delete`. `contact_roles` has no `deleted_at` on purpose, so the
  delete is a hard one — otherwise the `primary` slot would stay occupied forever.
- **A roles-only PATCH does not bump `contacts.updated_at`.** The roles live in their own table; the
  token is still verified against the row that was read, so a stale client still gets `409`.
- **The AIS-110 namespace did not change.** The four operations stay under `customers.*`, so the gate
  looks for the methods on the existing `CustomersService` — no second client service.

## Verification (all executed)

| Gate | Result |
| --- | --- |
| `pnpm --filter @callback/shared test` | **403 passed** / 26 suites (the registry spec now feeds a sample payload to the four new operations) |
| `pnpm --filter @callback/api test` | 797 → **815 passed** / 57 suites |
| `pnpm --filter @callback/api-client test` | 248 → **261 passed** / 11 suites (coverage gate green) |
| `pnpm typecheck` | every workspace `Done` |
| `pnpm lint` | clean (`api`, `admin`; `web` has no eslint config yet) |
| `pnpm quality` | layers, knip, palette, themes, field-errors, docs — 0 violations |
| `pnpm build` | every workspace `Done` (`nest build`, `tsc`, two `vite build`s) |
| `pnpm --filter @callback/api test:e2e` | 14 suites / 93 passed, `customer-contacts.e2e-spec.ts` among them — but the persistence cases **self-skip** without a reachable Postgres (`[database-gate]`, `DATABASE_URL` unset locally), so the compile and boot path is verified and the SQL assertions are not. Run `pnpm db:up` and re-run to exercise them. |

## Known limitations / follow-ups

- **No repository spec.** The Drizzle repository is exercised by the e2e suite (the only place where
  SQL shape matters for these queries); a mocked `Database` spec for `replaceRoles`/`deleteRoles` is a
  reasonable follow-up if the query shape ever needs to be pinned.
- **Slice e and f still open:** tags + customer users (`CUSTOMER_OWNER_CONFLICT`, the invite flow) and
  activities + `GET /:id/audit-logs`.
- **The admin UI is still AIS-179's job** — this slice ships the endpoints, the client methods and the
  copy only.
