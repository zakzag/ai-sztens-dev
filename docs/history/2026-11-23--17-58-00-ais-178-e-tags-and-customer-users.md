# AIS-178 / slice e — tags + customer users (API, client, contract, audit)

**Date:** 2026-11-23
**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Plan:** [`docs/plans/2026-11-23--17-28-00-ais-178-e-tags-and-customer-users-slice-plan.md`](../plans/2026-11-23--17-28-00-ais-178-e-tags-and-customer-users-slice-plan.md)
**Milestone:** [`docs/milestones/2026-11-23--17-58-00-ais-178-e-tags-and-customer-users.milestone.md`](../milestones/2026-11-23--17-58-00-ais-178-e-tags-and-customer-users.milestone.md)

## What was wrong

The `customers` detail response has been publishing `tags` and `customerUsers` since AIS-17, but nothing
could ever fill them: no controller, no registry entry, no client method (audit M3). That made the two
arrays read-only by construction and left two AIS-14 DoD cases untestable — "second `owner` → `409`" and a
working invitation state machine.

## What was built

Six registered operations, each with its controller, client method and registry entry in one change:

| operationId | verb | path |
| --- | --- | --- |
| `customers.createTag` | `POST` | `/api/admin/customers/:id/tags` |
| `customers.attachTag` | `PATCH` | `/api/admin/customers/:id/tags` |
| `customers.detachTag` | `DELETE` | `/api/admin/customers/:id/tags/:tagId` |
| `customers.inviteCustomerUser` | `POST` | `/api/admin/customers/:id/customer-users` |
| `customers.updateCustomerUser` | `PATCH` | `/api/admin/customers/:id/customer-users/:customerUserId` |
| `customers.removeCustomerUser` | `DELETE` | `/api/admin/customers/:id/customer-users/:customerUserId` |

## Decisions that shaped the code

- **Tags are create-or-attach by name.** `POST` reads the catalogue first, inserts only when the name is
  new, and treats a `23505` on `tags_name_key` as a lost race: the loser re-reads the winner's row in a
  **fresh** transaction (the aborted one cannot be reused) and attaches it. Detaching removes only the
  `customer_tags` link — one customer leaving a label must not delete it from everybody else.
- **Attach is idempotent**, because `customer_tags` has a composite primary key and the write uses
  `ON CONFLICT DO NOTHING`: a repeat answers `200` and writes **no** ledger row. Detaching an absent link is
  a `404`, per API-Convention §4.2.2.
- **The invitation is server-written**: `status = invited`, `invitedAt = now`,
  `invitedByOperatorId = null` (no session until AIS-73/74), `passwordHash = null`, `acceptedAt = null`.
  No e-mail is sent — the row is the pending invitation the auth story consumes.
- **The owner `409` fires at activation, not at invitation.** `customer_users_customer_owner_key` is partial
  (`role = 'owner' AND status = 'active'`), so a pending second owner is legal and `CUSTOMER_OWNER_CONFLICT`
  comes from the index when a second owner is activated — never from a pre-check that could not see the
  status and would still race.
- **`DELETE` on a login user revokes a pending invitation only.** `iam.customer_users` has no `deleted_at`
  and is referenced by `contacts` and `activities` (`NO ACTION`), so the row is deleted only while it is
  still `invited` (`422` otherwise). Deactivating an accepted user is `PATCH status = 'inactive'`, and a
  still-referenced row answers `409 CUSTOMER_USER_IN_USE_CONFLICT`.
- **Three new `409` codes**, all classified from constraint names, each with Hungarian admin copy:
  `CUSTOMER_USER_EMAIL_CONFLICT` (global, case-insensitive `customer_users_email_key`),
  `CUSTOMER_OWNER_CONFLICT`, `CUSTOMER_USER_IN_USE_CONFLICT`.

## Files

**Shared contract** (`packages/shared`): `customers.const.ts` (`CUSTOMERS_TAG_ID_PARAM`,
`CUSTOMERS_CUSTOMER_USER_ID_PARAM`, `CUSTOMER_USER_MANAGED_STATUS_VALUES`), `customers.schema.ts`
(`customerTagIdSchema`, `customerUserIdSchema`, `customerUserManagedStatusSchema`,
`updateCustomerUserSchema`), `customers.interface.ts` (`UpdateCustomerUserInput`), `customers.fixture.ts`
(`SECOND_CUSTOMER_TAG`, the three request fixtures), `customers.contract.ts` (six entries), `error-code.const.ts`
(three codes + status map), `index.ts` (exports), `test/endpoint-registry.test.ts` (sample payloads).

**API** (`apps/api/src/customers`): `customers-tags.{const,errors,error-guard,interface,mapper,repository.interface,repository,service,controller}.ts`,
`customers-users.{const,errors,error-guard,interface,mapper,repository.interface,repository,service,controller}.ts`,
`customers.module.ts` (two controllers + two repository tokens), `customers.mapper.ts` (reuses the extracted
`toCustomerTag` / `toCustomerUser`). OpenAPI: `common/openapi/zod-openapi.ts` + its spec (six new component
names).

**Tests**: `customers-tags.*.spec.ts`, `customers-users.*.spec.ts` (11 new suites), the mocks
`test/mocks/customers-tags.mock.ts` and `customers-users.mock.ts` (repository doubles + chainable
`Database` doubles), `apps/api/test/customer-tags.e2e-spec.ts`, `apps/api/test/customer-users.e2e-spec.ts`,
`packages/api-client/test/customers.service.test.ts` (+13 tests), `customers.module.spec.ts`.

**Client** (`packages/api-client`): `customers.const.ts` / `.path.ts` (four derived paths, four builders),
`customers.interface.ts` + `customers.service.ts` (six methods), `index.ts`, `test/mocks/customer.mock.ts`.

**Admin**: three error codes wired to Hungarian copy in `error-message.const.ts` / `api-error-code.const.ts`.

**Docs**: `docs/Specs/API-Convention.md` §12.2 (new subsection + header date), this file, the milestone.

## Measured evidence

```text
shared       403 passed (was 402 → +1 registry sample test data)
api-client   278 passed (was 265 → +13 for the six new methods and four paths)
api          911 passed (was 892 unit; 11 new suites, 96 tests in the two features)
admin        49 test files passed
gates        pnpm quality: layers, dead-code, tokens, themes, field-errors, docs — 0 violations
openapi      component list now carries AttachCustomerTag, CreateCustomerTag, CustomerTag,
             CustomerUser, InviteCustomerUser, UpdateCustomerUser
e2e          customer-tags + customer-users: 20 passed (app-module gate skips on Node 20.19)
```

One pre-existing gap was fixed on the way: `apps/admin/src/lib/api-error-code.test.ts` listed the
field-capable codes but was missing `CUSTOMER_PRIMARY_CONTACT_CONFLICT` (slice d added it), so the exact
`FIELD_SURFACE_CODES` assertion only passed by accident of ordering. The list is now complete and explicit.

## Verification

```text
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test          # incl. service-coverage
pnpm --filter @callback/api test
pnpm --filter @callback/api lint && pnpm --filter @callback/api typecheck && pnpm --filter @callback/api db:check
pnpm --filter @callback/admin test
pnpm quality
pnpm --filter @callback/api test:e2e -- customer-tags customer-users
```

`db:check` reports no schema drift: the four tables (`tags`, `customer_tags`, `customer_users`, `customers`)
come from AIS-18, so this slice adds **no migration**.
