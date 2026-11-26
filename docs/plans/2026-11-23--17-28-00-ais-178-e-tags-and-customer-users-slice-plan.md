# AIS-178 / slice e — `tags` + `customer users` (API, client, contract, audit)

**Ticket:** AIS-178 `Admin - impl: customers API és kapcsolódó erőforrások` (subtask of AIS-14)
**Slice lettering** (audit [`2026-11-23--15-23-00-ais-14-gap-analysis.md`](../history/2026-11-23--15-23-00-ais-14-gap-analysis.md:92), M3):
**a** contract ✅ · **b** `customers` API ✅ · **c** `api-client` ✅ · **d** contacts + roles ✅ · **e** = this plan (tags + customer users) · **f** activities + audit-log read.
**Parent plan:** [`2026-11-22--22-16-00-ais-178-b-customers-api-slice-plan.md`](./2026-11-22--22-16-00-ais-178-b-customers-api-slice-plan.md:1)
**Screen contract:** [`Customers-Admin-Screens.md`](../Specs/Customers-Admin-Screens.md:161) §3.2 (`tags` on the overview, `users` tab)
**Suggested branch:** `AIS-178-e-tags-customer-users`
**Commit title:** `AIS-178: feat(api): add customer tags and customer users endpoints`

---

## 0. Why this slice exists

The detail response already publishes `tags` and `customerUsers`, but **nothing can ever fill them**: there is no
endpoint, no registry entry, no client method. That is the "read-only by construction" defect the audit records as M3,
and it also blocks two DoD cases that cannot be tested today (a second `owner` → `409`; a working invitation state
machine).

Constraint that shapes the whole slice — unchanged since slice b:

> **Registry entry, `apps/api` controller and `api-client` method land in the same commit.** The
> `service-coverage` (AIS-110), `envelope-contract` and `openapi` gates all fail when one of the three is missing.

---

## 1. Decisions (closed with the requester)

| # | Question | Decision |
| --- | --- | --- |
| E1 | Tag endpoints | `POST /:id/tags` = **create-or-attach by name** (`createCustomerTagSchema`), `PATCH /:id/tags` = attach an existing tag (`attachCustomerTagSchema`), `DELETE /:id/tags/:tagId` = detach. No `GET /:id/tags`: the detail response already carries the attached tags. |
| E2 | Tag catalogue read (`GET /api/admin/tags`) | **Deferred** to a follow-up ticket. The attach picker of the `users`/`tags` UI needs it, but it is a new top-level resource with its own controller, and the ticket names only `/:id/tags`. |
| E3 | Customer-user endpoints | `POST /:id/customer-users` = invite, `PATCH /:id/customer-users/:customerUserId` = role/status/name, `DELETE /:id/customer-users/:customerUserId` = **revoke an invitation**. |
| E4 | "Delete" a customer user | `iam.customer_users` has **no `deleted_at`** and is referenced by `contacts.customer_user_id` and `activities.customer_user_id` (`NO ACTION`), so a hard delete is only safe while the row is still `invited`. Therefore: `DELETE` = hard delete **allowed only for `status = 'invited'`**; any other status answers `422 SEMANTIC_VALIDATION_FAILED`. Deactivating an accepted user is `PATCH status = 'inactive'`. |
| E5 | Where does the second-`owner` `409` come from? | The partial unique index `customer_users_customer_owner_key` covers `role = 'owner' AND status = 'active'`, so an **invitation** never violates it. `CUSTOMER_OWNER_CONFLICT` is therefore raised at **activation** (`PATCH status = 'active'` on an owner while another active owner exists), classified from the constraint name — never from a pre-check. A pending second owner is legal (it is an invitation, not a privilege) and is documented. |
| E6 | Duplicate invitation e-mail | `customer_users_email_key` is a **global**, case-insensitive unique index (`lower(email)`), so the second invitation of the same address — in *any* customer — is `409 CUSTOMER_USER_EMAIL_CONFLICT` with `details[0].path = 'email'`. |
| E7 | Is a tag name unique? | `tags_name_key` is a plain `UNIQUE(name)`, case-**sensitive**. `POST` therefore reuses an existing row of the same name instead of failing: find → else insert → on `23505` re-read once and reuse (the same "retry once" shape `customer_number` uses). Two names differing only in case are two tags; documented, not "fixed" here. |
| E8 | Attach idempotency | Attaching an already attached tag is a **no-op** (`200`, the tag, **no** audit row) — a repeat is not a new fact. Detaching a link that does not exist is `404`, matching the repo-wide delete rule (API-Convention §4.2.2). |
| E9 | `invitedByOperatorId` | `null` until AIS-73/74: there is no session, and the audit actor is `system` (plan `D-A`). Filling it with an invented operator id would be a lie in a column that is FK-checked. |
| E10 | Who "accepts" an invitation? | Nobody in this slice. There is no mail provider and no accept endpoint; the row (`invited`, `invitedAt`) is the pending invitation the auth story consumes. Activating it by hand is `PATCH status = 'active'`. |
| E11 | Detaching a tag deletes the catalogue row? | **Never.** `customer_tags` is the link; the label is shared. Deleting a link frees the label for reuse and leaves every other customer untouched. |

---

## 2. Pre-flight findings

| # | Finding | Consequence |
| --- | --- | --- |
| F1 | All four request schemas already exist: [`createCustomerTagSchema`](../../packages/shared/src/contract/customers/customers.schema.ts:494), [`attachCustomerTagSchema`](../../packages/shared/src/contract/customers/customers.schema.ts:501), [`inviteCustomerUserSchema`](../../packages/shared/src/contract/customers/customers.schema.ts:485) — plus response schemas `customerTagSchema` / `customerUserSchema` and fixtures `VALID_CUSTOMER_TAG`, `VALID_CUSTOMER_USER`, `INVITED_CUSTOMER_USER` | The only **new** schema is `updateCustomerUserSchema`; nothing is duplicated. |
| F2 | `tags` and `customer_users` are both already in [`AUDIT_TABLE_NAMES`](../../apps/api/src/audit/audit.const.ts:33) | No audit-module change; the writer accepts both payloads as they are. |
| F3 | `customer_tags` has a **composite PK** and no uuid identity | Its audit rows carry `record_id = null` and the `{ customer_id, tag_id }` pair in `before`/`after` — exactly the case the ledger docblock already describes ([`schema.ts`](../../apps/api/src/db/schema.ts:835)). |
| F4 | The detail read in [`customers.repository.ts`](../../apps/api/src/customers/customers.repository.ts:210) already selects tags and users; [`customers.mapper.ts`](../../apps/api/src/customers/customers.mapper.ts:104) maps users inline | No change to the detail path. The inline mapping is **extracted** to a reusable `toCustomerUser()` so the new endpoints do not carry a second copy. |
| F5 | `customers-contacts.*` is the working template (const → errors → error-guard → mapper → repository → service → controller), incl. `runInTransaction`, `@Req()` audit facts and `ZodValidationPipe(customerIdSchema)` | Slices e1/e2 follow the same file layout and the same `AppError` translation; no new pattern is invented. |
| F6 | `apps/api/src/customers/customers.module.ts` binds repositories by string token | Two new tokens (`CUSTOMER_TAGS_REPOSITORY`, `CUSTOMER_USERS_REPOSITORY`), two new controllers, `customers.module.spec.ts` extended. |
| F7 | `resolveApiErrorStatus` / [`error-code.const.ts`](../../packages/shared/src/contract/error-code.const.ts:21) has no owner/email/in-use code; the admin copy-parity test asserts the catalogue **exactly** | The three codes and their Hungarian copy must land in the same commit, or `apps/admin` tests fail. |
| F8 | The AIS-110 gate derives the client method name from the `operationId` (`<namespace>.<method>`) | Method names are fixed by the registry ids below: `createTag`, `attachTag`, `detachTag`, `inviteCustomerUser`, `updateCustomerUser`, `removeCustomerUser`. |
| F9 | `delete` is allowed on `customer_users` at the DB level (no immutability trigger, only `audit.audit_logs` has one) | The `DELETE` route is implementable; its **guard** is the "invited only" rule (`E4`), not a trigger. |

---

## 3. Deliverables

### 3.1 Registry entries (all six in one commit)

| operationId | verb | path | validation | success | audit rows |
| --- | --- | --- | --- | --- | --- |
| `customers.createTag` | `POST` | `/api/admin/customers/:id/tags` | `customerIdSchema` + `ZodBodyPipe(createCustomerTagSchema)` | `201` `CustomerTag` | `tags` `insert` **only if the label was created**; `customer_tags` `insert` **only if the link was created** |
| `customers.attachTag` | `PATCH` | `/api/admin/customers/:id/tags` | `customerIdSchema` + `ZodBodyPipe(attachCustomerTagSchema)` | `200` `CustomerTag` | `customer_tags` `insert` only when newly attached |
| `customers.detachTag` | `DELETE` | `/api/admin/customers/:id/tags/:tagId` | both params via `ZodValidationPipe` | `200`, `data: null` | `customer_tags` `delete` |
| `customers.inviteCustomerUser` | `POST` | `/api/admin/customers/:id/customer-users` | `customerIdSchema` + `ZodBodyPipe(inviteCustomerUserSchema)` | `201` `CustomerUser` | `customer_users` `insert` |
| `customers.updateCustomerUser` | `PATCH` | `/api/admin/customers/:id/customer-users/:customerUserId` | both params + `ZodBodyPipe(updateCustomerUserSchema)` | `200` `CustomerUser` | `customer_users` `update` (changed keys only) |
| `customers.removeCustomerUser` | `DELETE` | `/api/admin/customers/:id/customer-users/:customerUserId` | both params | `200`, `data: null` | `customer_users` `delete` |

### 3.2 New error codes (`409`, all three from constraint names)

| Code | Constraint | `details[0].path` | Hungarian copy (admin) |
| --- | --- | --- | --- |
| `CUSTOMER_USER_EMAIL_CONFLICT` | `customer_users_email_key` (global, `lower(email)`) | `email` | „Ezzel az e-mail-címmel már létezik belépő felhasználó.” |
| `CUSTOMER_OWNER_CONFLICT` | `customer_users_customer_owner_key` (partial: `owner` + `active`) | `role` | „Ennél az ügyfélnél már van aktív tulajdonos.” |
| `CUSTOMER_USER_IN_USE_CONFLICT` | `contacts_customer_user_id_fkey` / `activities_customer_user_id_fkey` (`23503`) | `id` | „A felhasználóhoz még kapcsolattartó vagy tevékenység tartozik.” |

A `23505`/`23503` from **any other** constraint stays a `500`.

### 3.3 New files — `apps/api/src/customers/customers-tags.*`

| File | Content |
| --- | --- |
| `customers-tags.const.ts` | `CUSTOMER_TAGS_REPOSITORY`, `CUSTOMER_TAGS_ROUTE = 'admin/customers/:id/tags'`, constraint names (`tags_name_key`, `customer_tags_pkey`), table names (`tags`, `customer_tags`), `TAG_ATTACH_ATTEMPTS = 2` |
| `customers-tags.errors.ts` | `TagRowMissingError`, `TagNotAttachedError`, `TagNameRaceError` (no Nest import) |
| `customers-tags.error-guard.ts` | `isTagNameConflict` (`23505` + `tags_name_key`), `isTagLinkConflict` (`23505` + `customer_tags_pkey`), built on the shared [`findPostgresError`](../../apps/api/src/db/postgres-error.logic.ts:1) |
| `customers-tags.interface.ts` | `TagAttachment { tag, linked }`, `TagPage`-free (no list), `TagAuditPayload` |
| `customers-tags.mapper.ts` | pure: `toCustomerTag(row)`, `toTagAuditPayload(row)`, `toLinkAuditPayload(customerId, tagId)` |
| `customers-tags.repository.interface.ts` / `.repository.ts` | `customerExists`, `findTagByName`, `findTagById`, `insertTag(tx)`, `attach(tx, customerId, tagId)`, `detach(tx, customerId, tagId)`, `runInTransaction` |
| `customers-tags.service.interface.ts` / `.service.ts` | orchestration: resolve parent → `404`; create-or-attach with one retry; idempotent attach; detach → `404` when no link; one `AuditWriter.write` per changed row |
| `customers-tags.controller.ts` | three routes, `ZodBodyPipe` / `ZodValidationPipe`, `responses.ok(...)`, `@Req()` facts on all three |
| `customers-tags.*.spec.ts` | see §6 |
| `test/mocks/customers-tags.mock.ts` | tag/link row fixtures + repository double (no mocks inside specs) |

### 3.4 New files — `apps/api/src/customers/customers-users.*`

| File | Content |
| --- | --- |
| `customers-users.const.ts` | `CUSTOMER_USERS_REPOSITORY`, `CUSTOMER_USERS_ROUTE = 'admin/customers/:id/customer-users'`, the three constraint names above, table name, `CUSTOMER_USER_INITIAL_STATUS = 'invited'` |
| `customers-users.errors.ts` | `CustomerUserEmailConflictError`, `CustomerOwnerConflictError`, `CustomerUserInUseError`, `CustomerUserRowMissingError`, `CustomerUserNotInvitedError` |
| `customers-users.error-guard.ts` | the three constraint guards (`23505` / `23503` + constraint name) |
| `customers-users.interface.ts` | `CustomerUserPatch`, `NewCustomerUserDraft` |
| `customers-users.mapper.ts` | pure: `toCustomerUser(row)` (moved out of `customers.mapper.ts` and reused there), `toNewCustomerUserRow(customerId, input, now)`, `toCustomerUserPatch(input)`, `toCustomerUserAuditPayload(row)` |
| `customers-users.repository.interface.ts` / `.repository.ts` | `customerExists`, `findById(customerId, userId)`, `insert(tx, row)`, `updateById(tx, customerId, userId, patch, expectedUpdatedAt)`, `deleteById(tx, customerId, userId)`, `runInTransaction` |
| `customers-users.service.interface.ts` / `.service.ts` | invite / patch / revoke orchestration + `409`/`422` translation + `STALE_WRITE` classification |
| `customers-users.controller.ts` | three routes, both path params validated |
| `customers-users.*.spec.ts` | see §6 |
| `test/mocks/customers-users.mock.ts` | row fixtures + repository double |

### 3.5 Modified files

| File | Change |
| --- | --- |
| `packages/shared/src/contract/customers/customers.schema.ts` | `updateCustomerUserSchema` (`name?`, `role?`, `status?` limited to `active`/`inactive`, required `updatedAt`, `.strict()`); `customerUserIdSchema`, `customerTagIdSchema` path-param schemas if absent |
| `packages/shared/src/contract/customers/customers.const.ts` | `CUSTOMERS_TAG_ID_PARAM = ':tagId'`, `CUSTOMERS_CUSTOMER_USER_ID_PARAM = ':customerUserId'`, `CUSTOMER_USER_MANAGED_STATUS_VALUES = ['active','inactive']` |
| `packages/shared/src/contract/customers/customers.interface.ts` | `UpdateCustomerUserInput` |
| `packages/shared/src/contract/customers/customers.fixture.ts` | `VALID_UPDATE_CUSTOMER_USER_REQUEST`, `VALID_CREATE_CUSTOMER_TAG_REQUEST`, `VALID_ATTACH_CUSTOMER_TAG_REQUEST` |
| `packages/shared/src/contract/customers/customers.contract.ts` | the six entries of §3.1 + the tag/customer-user path constants |
| `packages/shared/src/contract/error-code.const.ts` | three codes + `API_ERROR_CODE_STATUS` rows (`409`) |
| `apps/admin/src/lib/error-message.const.ts`, `api-error-code.const.ts` | the three Hungarian messages (+ `fieldMessage` for `email` and `role`) |
| `apps/admin/src/lib/api-error-code.test.ts` | the parity fixture list gains the three codes |
| `apps/api/src/customers/customers.module.ts`, `customers.module.spec.ts` | two controllers, two repository bindings |
| `apps/api/src/customers/customers.mapper.ts` | uses the extracted `toCustomerUser()` |
| `packages/api-client/src/customers/customers.const.ts`, `.path.ts` | paths via `clientPathOf('customers.createTag' \| 'customers.updateCustomerUser')` + `toCustomerTagsPath`, `toCustomerTagPath`, `toCustomerUsersPath`, `toCustomerUserPath` |
| `packages/api-client/src/customers/customers.interface.ts`, `.service.ts` | the six methods, each parsing the response with the shared schema |
| `packages/api-client/test/customers.service.test.ts` | success + error per new method |
| `docs/Specs/API-Convention.md` | §4.3 table extended with the six routes + the three `409` codes; header date bumped |
| `docs/history/<ts>-ais-178-e-tags-and-customer-users.md` | change summary with the measured evidence |
| `docs/milestones/<ts>-ais-178-e-tags-and-customer-users.milestone.md` | decision-grade summary (E4–E9, the owner-at-activation rule) |

**Not touched:** `apps/api/drizzle/*` (no schema change, no migration), `infra/*`, `apps/admin/src/pages` (AIS-179 owns the UI).

---

## 4. Behaviour that must hold

1. `POST /:id/tags`: an existing **same-name** tag is reused (no second `tags` row); the link is created only if absent; a repeat is a no-op with **no** audit row; the answer is `201` with the tag either way.
2. `POST /:id/tags` under contention: a `23505` on `tags_name_key` re-reads the row **once in a fresh transaction** and attaches it; a second failure is a `500` (a genuine catalogue inconsistency, not a client error).
3. `PATCH /:id/tags`: unknown tag id, or a tag with `isActive = false`, is `422 SEMANTIC_VALIDATION_FAILED` with `details[0].path = 'tagId'`; an already attached tag is a no-op `200`; otherwise one `customer_tags` `insert` audit row.
4. `DELETE /:id/tags/:tagId`: one `DELETE` on the link; no link is `404`; the `tags` row is never touched; `200` with `data: null`.
5. `POST /:id/customer-users`: the server writes `status = 'invited'`, `invitedAt = now`, `invitedByOperatorId = null`, `passwordHash = null`, `acceptedAt = null`, `lastLoginAt = null`; `role` comes from the body (default `member`); the response is `201` with the stored row. No e-mail is sent (`E10`).
6. Duplicate invitation e-mail (case-insensitive, any customer) → `409 CUSTOMER_USER_EMAIL_CONFLICT`, `details[0].path = 'email'`.
7. `PATCH /:id/customer-users/:customerUserId`: `updatedAt` required and never written; a mismatch is `409 STALE_WRITE`; `status` accepts only `active` / `inactive`; making a second **active owner** is `409 CUSTOMER_OWNER_CONFLICT` (`details[0].path = 'role'`); an empty patch (`updatedAt` only) returns the current row with no write and no audit row.
8. `DELETE /:id/customer-users/:customerUserId`: only `status = 'invited'` may be revoked (`422` otherwise); the row is hard-deleted with one `delete` audit row; a surviving `contacts`/`activities` reference (`23503`) is `409 CUSTOMER_USER_IN_USE_CONFLICT`.
9. Every route is scoped by `customer_id`: another customer's tag link or user is `404`, never `403` and never a cross-customer write.
10. Every mutation writes exactly **one** audit row per changed table row, on the caller's transaction, with `customer_id` set; `customer_tags` rows carry `record_id = null` and the `{customer_id, tag_id}` pair.
11. No new `422`-vs-`409` ambiguity: a **state** rule (`invited` only) is `422`, a **uniqueness/reference** conflict is `409`.

---

## 5. Data model notes (no migration)

| Table | Rule the endpoint relies on | Consequence |
| --- | --- | --- |
| `customer.tags` | `tags_name_key` `UNIQUE(name)`, case-sensitive | create-or-reuse by exact name (`E7`) |
| `customer.customer_tags` | composite PK `(customer_id, tag_id)`, both FKs `CASCADE` | attach is idempotent by PK conflict (`E8`); a customer delete already removes its links |
| `iam.customer_users` | `customer_users_email_key` `UNIQUE(lower(email))` **global** | the duplicate-email `409` (`E6`) |
| `iam.customer_users` | `customer_users_customer_owner_key` partial (`owner` + `active`) | the owner `409` fires at activation only (`E5`) |
| `iam.customer_users` | no `deleted_at`; referenced by `contacts` / `activities` (`NO ACTION`) | delete is invitation-only (`E4`) |

---

## 6. Tests

| Suite | Coverage |
| --- | --- |
| `customers-tags.error-guard.spec.ts` | both guards; the cross cases (link conflict is not a name conflict); wrapped `cause` chain |
| `customers-tags.mapper.spec.ts` | tag mapping, link audit payload (`record_id = null`), `Date` → ISO where applicable |
| `customers-tags.repository.spec.ts` | mocked `Database`: `findTagByName` case-sensitivity, `attach` `ON CONFLICT` shape, `detach` returning `null`, `customerExists` soft-delete filter, `runInTransaction` handle |
| `customers-tags.service.spec.ts` | reuse instead of insert; retry-once on `23505`; no-op repeat → no audit row; `422` for unknown/inactive tag; detach `404`; one audit row per changed row, same `tx` |
| `customers-tags.controller.spec.ts` | `201`/`200`/`data: null`, param validation, audit facts from the request |
| `customers-users.error-guard.spec.ts` | email / owner / in-use guards; the cross cases |
| `customers-users.mapper.spec.ts` | invite defaults (`invited`, `invitedById = null`), patch `undefined` vs `null`, audit payload keys |
| `customers-users.repository.spec.ts` | guarded update SQL (`updated_at = expected`), `deleteById` scope by customer, constraint → domain error |
| `customers-users.service.spec.ts` | invite audit row; `409` mapping of all three codes; `STALE_WRITE`; empty patch no-op; `422` revoking an accepted user; unknown user `404` |
| `customers-users.controller.spec.ts` | payloads, status codes, both params validated |
| `customers.module.spec.ts` | `CUSTOMER_TAGS_REPOSITORY` + `CUSTOMER_USERS_REPOSITORY` and `AUDIT_WRITER` resolve |
| `packages/api-client/test/customers.service.test.ts` | each of the six methods: success + `ApiError` path + path substitution |
| `apps/api/test/customer-tags.e2e-spec.ts` | real Postgres: create tag → detail carries it → attach a second existing tag → repeat is a no-op → detach → `404` on repeat; `422` unknown/inactive tag; **audit row counts** per step; catalogue row survives detach |
| `apps/api/test/customer-users.e2e-spec.ts` | invite (`invited`, `invitedAt` set, `invitedById` null) → duplicate e-mail `409` → activate → second owner `409 CUSTOMER_OWNER_CONFLICT` → `PATCH` stale `409` → revoke an `invited` user → `422` revoking an active one → unknown user `404`; one audit row per mutation |
| gates | `envelope-contract` (verb + path), `openapi` (registry-driven), `service-coverage` (six new methods), admin copy parity |

E2E hygiene: unique `e2e-<uuid>` names; `customer.tags`, `customer.customer_tags` and `iam.customer_users` rows are removed in `afterAll` (the customer cascade covers the link and user rows), `audit.audit_logs` rows are **kept** and tagged with a fixed `user-agent` — the trigger forbids deleting them, and that is the append-only rule doing its job.

---

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| `/tags` `POST` becomes a "create duplicate labels" hole | create-or-reuse by exact name; `tags_name_key` classified, and the retry makes a race harmless |
| The owner `409` is untestable at invite time | It is tested at **activation** (`E5`); the e2e activates two owners in one customer |
| Hard-deleting a user breaks a contact or an activity | `23503` mapped to `409 CUSTOMER_USER_IN_USE_CONFLICT`; the route also refuses anything that is not `invited` |
| `updateCustomerUserSchema` lets a client forge `invited` | `status` is restricted to `active` / `inactive` (`E4`) |
| The new codes drift from the admin copy | The parity test in `apps/admin` fails on any missing entry; both files change in the same commit |
| A second copy of the user mapping | `toCustomerUser()` is extracted and the detail path reuses it (`F4`) |
| Registry/client/controller land apart | All six entries ship with their controller **and** client method in one commit (§0) |

---

## 8. Verification

```text
shared:  pnpm --filter @callback/shared test
api:     pnpm --filter @callback/api test
         pnpm --filter @callback/api lint
         pnpm --filter @callback/api typecheck
         pnpm --filter @callback/api db:check
client:  pnpm --filter @callback/api-client test        # incl. service-coverage
admin:   pnpm --filter @callback/admin test             # error-copy parity
e2e:     pnpm --filter @callback/api test:e2e -- customer-tags customer-users envelope-contract openapi
docs:    pnpm quality
all:     pnpm typecheck && pnpm build && pnpm test
```

Definition of done for slice e:

- [ ] Six routes mounted; `envelope-contract`, `openapi` and `service-coverage` green.
- [ ] A tag created by `POST` appears in `GET /:id`; a repeat of the same `POST` creates nothing and audits nothing.
- [ ] Detach frees the label without deleting the catalogue row.
- [ ] Invite writes `invited` + `invitedAt`, `invitedById = null`, and the second active owner is `409 CUSTOMER_OWNER_CONFLICT`.
- [ ] Duplicate e-mail is `409 CUSTOMER_USER_EMAIL_CONFLICT`; revoking an accepted user is `422`.
- [ ] Exactly one audit row per changed row, on the caller's transaction.
- [ ] `docs/Specs/API-Convention.md` updated in the same change; history entry and milestone written.

---

## 9. Out of scope

- **Slice f** — `activities` CRUD + `GET /:id/audit-logs` (the AIS-14 DoD e2e chain).
- **`GET /api/admin/tags`** — the paged tag catalogue read (`E2`); follow-up ticket.
- **Invitation e-mail delivery and the accept endpoint** — the auth story (AIS-73/74); the row is the pending invitation (`E10`).
- **The admin UI** for the `tags` / `users` tabs — AIS-179.
- **Admin authentication / real audit actor** — the actor stays `system`; ledger rows of this period are not backfillable.
