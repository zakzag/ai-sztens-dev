# AIS-178/e — customer tags and login users: three constraints decide three answers

**Date:** 2026-11-23 · **Ticket:** AIS-178 (subtask of AIS-14) · **Plan:**
[`docs/plans/2026-11-23--17-28-00-ais-178-e-tags-and-customer-users-slice-plan.md`](../plans/2026-11-23--17-28-00-ais-178-e-tags-and-customer-users-slice-plan.md)

## 1. Problem

`GET /api/admin/customers/:id` has published `tags` and `customerUsers` since AIS-17, but no endpoint could
create them: both arrays were read-only by construction, and two AIS-14 DoD cases ("second `owner` → `409`",
an invitation state machine) had no write path to test.

## 2. Evidence

Before the slice: `API_ENDPOINTS` carried six `customers` operations and four `customers.*Contact` ones; the
AIS-110 gate was green because the client matched exactly that set, while `customers.tags` /
`customers.customerUsers` could only ever be `[]`. `customer_users_customer_owner_key` and
`customer_users_email_key` existed with no caller, so neither constraint could ever answer a client error.

## 3. Design rationale (the parts a future reader needs)

| Constraint | Predicate | Consequence for the API |
| --- | --- | --- |
| `customer_users_email_key` | `UNIQUE (lower(email))`, **global** | one address = one login across every customer → `409 CUSTOMER_USER_EMAIL_CONFLICT` on `email` |
| `customer_users_customer_owner_key` | `UNIQUE (customer_id) WHERE role='owner' AND status='active'` | a pending second owner is **legal**; the `409 CUSTOMER_OWNER_CONFLICT` surfaces at **activation**, never at invitation |
| `tags_name_key` | `UNIQUE (name)`, case-sensitive | `POST /tags` is **create-or-attach**: reuse the row, retry the loser of a race |

Two alternatives were rejected:

- **Pre-checking "is there already an owner?"** — it cannot see `status`, and it races. The index is the only
  honest classifier.
- **`DELETE` = deactivate** — `iam.customer_users` has no `deleted_at`, and the row is referenced by
  `contacts.customer_user_id` and `activities.customer_user_id` (`NO ACTION`). So `DELETE` revokes a row that
  is still `invited` (a hard delete of a never-accepted invitation), anything else is `422`, and a referenced
  row is `409 CUSTOMER_USER_IN_USE_CONFLICT` with "deactivate it instead" in the message.

Also fixed: the tag **catalogue is shared**, so detaching removes only the `customer_tags` link, and an attach
of an already attached label writes no ledger row (`ON CONFLICT DO NOTHING` plus the "a no-op audits nothing"
rule the customer `PATCH` already follows).

## 4. Implementation

- **Contract** (`packages/shared/src/contract/customers`): `updateCustomerUserSchema` (status limited to
  `active`/`inactive`, `updatedAt` required), `customerTagIdSchema`, `customerUserIdSchema`, the two path
  parameters, three error codes with status rows, six registry entries, three request fixtures.
- **API** (`apps/api/src/customers`): `customers-tags.*` and `customers-users.*` following the contacts
  template (const → errors → error-guard → mapper → repository → service → controller), one transaction per
  write with its `AuditWriter` row, `toCustomerTag` / `toCustomerUser` extracted so the detail path reuses
  them; `customers.module.ts` wires two controllers and two repository tokens.
- **Client** (`packages/api-client/src/customers`): four registry-derived paths and six methods.
- **OpenAPI** (`common/openapi/zod-openapi.ts`): six new component names.
- **Admin**: Hungarian copy for the three codes, both page and field variants where an input exists.
- **No migration**: every table and index exists since AIS-18; `db:check` reports no drift.

## 5. Outcome and how to verify

- Invite → duplicate e-mail `409` → activate → second owner `409` → stale `409` → revoke an invitation →
  `422` on an activated user → `409` on a referenced one.
- Tag create → detail carries it → reuse creates nothing → attach/detach idempotency → catalogue survives.

```text
pnpm --filter @callback/api test                  # 911 passed
pnpm --filter @callback/api-client test           # 278 passed (incl. service-coverage)
pnpm --filter @callback/shared test               # 403 passed
pnpm --filter @callback/admin test                # 49 files passed
pnpm quality                                      # 0 violations
pnpm --filter @callback/api test:e2e -- customer-tags customer-users
```

## 6. Follow-ups

- `GET /api/admin/tags` (paged catalogue read) — the attach picker has no way to discover tag ids yet.
- Slice **f**: activities + `GET /:id/audit-logs`, which completes the AIS-14 e2e chain.
- Invitation delivery and the accept endpoint belong to the auth story (AIS-73/74); `invitedByOperatorId`
  stays `null` until then, and the whole period's ledger rows say `system` (not backfillable).
- On Node < 24.9 the e2e suites self-skip (CommonJS `@nestjs/config` + Jest ESM); run them in CI or a manual
  `pnpm start` + curl session.
