# Local dev DB: `0008` applied, Jira tidied, two commits pushed

**Ticket:** AIS-189 (the migration that is applied here), AIS-15 (the wave that needs a
working local DB).

## What was asked

Three closing steps before the AIS-19 admin work can start:

1. push the two local commits (`943e7bb` spec fix, `79d1ae2` state audit),
2. put Jira in line with the real state,
3. apply migration `0008` to the local dev database.

## 1. The two commits are on the remote

`git push` failed once with `remote: Internal Server Error` (GitHub Request ID
`62E1:258512`); the retry went through:

```text
5d0e9ab..79d1ae2  AIS-14-company-admin -> AIS-14-company-admin
```

They sit on `AIS-14-company-admin` on top of the merged PR #12, so `main` already
contains everything they document. They are documentation only (one spec row + the audit
file), so they do not change behaviour.

## 2. Jira

| Ticket  | Before    | After | Why                                                                                        |
| ------- | --------- | ----- | ------------------------------------------------------------------------------------------ |
| AIS-189 | To Do     | Done  | the whole removal (contract, API, `0008`, specs, gates) is merged with PR #12               |
| AIS-17  | To Do     | Done  | the A1–A9 spec deltas are merged (`6ca342f`, in PR #12)                                     |
| AIS-14  | In Review | Done  | PR #12 merged                                                                            |
| AIS-182 | To Do     | To Do | description rewritten: `D-W6` company-only wizard, `D-W1` tags, `D11` step-in-store, no contact creation |
| —       | Q-1       | —     | no Jira ticket exists for it (verified by search), so there was nothing to close            |

A merge summary comment was added to AIS-189. Transition id `41` was the only available
path to `Done` in this workflow.

## 3. `0008` on the local dev DB — and the trap in it

`infra-postgres-1` was up and `infra/.env.local` was resolvable, but the first attempt
failed on the very first statement:

```text
$ pnpm --filter @callback/api db:migrate
[db:migrate] failed: Failed query: ALTER TABLE "customer"."customers" DROP CONSTRAINT "customers_responsible_operator_id_operators_id_fk";
```

Two wrong hypotheses were ruled out with evidence:

| Hypothesis                                          | Check                                                                  | Result                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| "the column is already gone, nothing to do"          | `select … from information_schema.columns where column_name='responsible_operator_id'` as `aisztens` | 0 rows — but **misleading**: the role had no privilege on the schema at all |
| "the migration runner is broken / `0008` is bad"     | `select count(*) from platform.__drizzle_migrations` as `postgres`      | 8 rows, so `0008` was genuinely pending, and the column existed |

The real state (as `postgres`):

```text
 nspname  |  owner   |                                     nspacl
----------+----------+--------------------------------------------------------------------------------
 activity | postgres |
 audit    | postgres |
 customer | postgres |
 email    | postgres | {postgres=UC/postgres,aisztens=U/postgres,tkovari=U/postgres,krak=U/postgres}
 iam      | postgres |
 platform | postgres | {postgres=UC/postgres,aisztens=UC/postgres,tkovari=U/postgres,krak=U/postgres}
```

So the local volume predated AIS-18/AIS-177: the four domain schemas had no grant matrix
**and** their tables were owned by `postgres`, because an earlier migration run used the
superuser credentials. `ALTER TABLE` needs table ownership, not schema `CREATE` — which is
why the error was neither `permission denied for schema …` nor anything self-explanatory.

Fix, in this order (documented as `Database-Local.md` §8.1):

```bash
# tables, sequences and enum types → the app role
docker exec -i infra-postgres-1 psql -U postgres -d aisztens_db <<'SQL'
do $$ … alter table/sequence/type … owner to aisztens … $$;
SQL

# schema owner stays postgres (the fresh-volume invariant), grants are restored
docker exec infra-postgres-1 bash /docker-entrypoint-initdb.d/02-schemas.sh
```

Then:

```text
$ pnpm --filter @callback/api db:migrate
[db:migrate] migrations applied (bookkeeping: platform.__drizzle_migrations)
```

Verified afterwards (as `postgres`):

| Check                                                                    | Result                                       |
| ------------------------------------------------------------------------ | -------------------------------------------- |
| `platform.__drizzle_migrations` row count                                 | **9**                                        |
| `customer.customers.responsible_operator_id` column                       | **absent** (0 rows)                           |
| schema owners of `platform`/`email`/`customer`/`iam`/`activity`/`audit`    | `postgres` for all six                        |
| `nspacl` on all six                                                       | `USAGE` for all three roles, `CREATE` for `aisztens` on the five app schemas |
| `tableowner` of the 9 tables in the four domain schemas                    | `aisztens` for all nine                       |
| `db:migrate` re-run (idempotency)                                         | passes, no pending migration                  |

## Files changed in this chat

| File                                        | Change                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md) | new §8.1 (table-ownership symptom, diagnosis, fix, expected end state), a new §10 diagnostics row, header date |

No code changed: the migration and the grants were applied to the local database only.

## How to verify this entry

```bash
docker exec infra-postgres-1 psql -U postgres -d aisztens_db \
  -c "select count(*) from platform.__drizzle_migrations;" \
  -c "select tableowner, count(*) from pg_tables where schemaname in ('customer','iam','activity','audit') group by tableowner;"
pnpm quality:docs
```

## Follow-ups

- The dev/prod databases still need `0008`; the deploy runs `db:migrate` after the build.
  Pre-check before deploying: `select count(*) from customer.customers where responsible_operator_id is not null`
  (expected `0`, otherwise the drop silently discards a real assignment).
- Any developer whose local volume predates AIS-18/AIS-177 hits the same trap; `§8.1` is
  now the recipe. Re-initialising the volume (`down -v` + `db:up`) is the alternative.
