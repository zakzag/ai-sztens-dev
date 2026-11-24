# Local DB: a hidden `ALTER TABLE` failure, caused by table ownership

**Ticket:** AIS-189 (the migration that exposed it). Date: 2026-11-24.

## Problem

Applying migration `0008` (drop `customer.customers.responsible_operator_id`) to the local
dev database failed on its very first statement, with an error that names the statement but
not the reason:

```text
[db:migrate] failed: Failed query: ALTER TABLE "customer"."customers" DROP CONSTRAINT "customers_responsible_operator_id_operators_id_fk";
```

## Measured evidence

| Probe (as `aisztens`)                                                | Result                                     | Reading                              |
| -------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| `information_schema.columns` for `responsible_operator_id`            | 0 rows                                     | looked like "already dropped"        |
| `select count(*) from customer.customers`                             | `ERROR: permission denied for schema customer` | the 0 rows were a privilege artefact |

| Probe (as `postgres`)                                                 | Result                                              |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `select count(*) from platform.__drizzle_migrations`                   | **8** — `0008` genuinely pending                    |
| `customer.customers.responsible_operator_id` column                    | **exists**                                          |
| `nspacl` of `customer`/`iam`/`activity`/`audit`                        | **empty** (no grant matrix at all)                  |
| `tableowner` of the nine tables in those schemas                       | **`postgres`**                                      |

## Root cause

Two independent gaps in the same local volume, which predates AIS-18/AIS-177:

1. `02-schemas.sh` had never been re-run on it, so the four domain schemas carried no
   `USAGE`/`CREATE` grants for `aisztens`, `tkovari`, `krak`.
2. The tables in those schemas had been created by a migration run with the **superuser**
   credentials, so their owner was `postgres`. `ALTER TABLE` requires *table* ownership (or
   superuser), not schema `CREATE` — therefore the failure was neither
   `permission denied for schema …` (which the spec's diagnostics table predicts) nor
   self-explanatory: Drizzle prints only `Failed query: …`.

Symptom 1 alone would not have blocked `0008`; symptom 2 alone explains the failure.

## Solution

```bash
# 1) tables, sequences and enum types → the app role (the migration creator)
docker exec -i infra-postgres-1 psql -U postgres -d aisztens_db <<'SQL'
do $$ … alter table / sequence / type … owner to aisztens … $$;
SQL

# 2) the documented, idempotent grant matrix (schema owner stays postgres)
docker exec infra-postgres-1 bash /docker-entrypoint-initdb.d/02-schemas.sh
```

Deliberate choice: **only the object owners change, not the schema owners.** A fresh volume
runs `02-schemas.sh` first (`postgres` owns the schemas) and the migration second (`aisztens`
owns the tables) — so the repaired volume now matches a fresh one exactly, instead of
introducing a third state.

Changed files:

| File                                                              | Change                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`docs/Specs/Database-Local.md`](../Specs/Database-Local.md)      | new §8.1 with symptom, diagnosis, fix and the expected end state; a new §10 diagnostics row; header date |

No application code changed; the database was repaired, the spec learned the trap.

## Outcome and how to verify

`0008` applied, and the volume is indistinguishable from a freshly initialised one:

```bash
docker exec infra-postgres-1 psql -U postgres -d aisztens_db \
  -c "select count(*) as applied from platform.__drizzle_migrations;" \
  -c "select tableowner, count(*) from pg_tables where schemaname in ('customer','iam','activity','audit') group by tableowner;" \
  -c "select nspname, pg_get_userbyid(nspowner) as owner from pg_namespace where nspname in ('platform','email','customer','iam','activity','audit');"
# expected: applied = 9; tableowner = aisztens (9); owner = postgres (6)

pnpm --filter @callback/api db:migrate   # expected: passes, nothing pending
```

## Follow-ups

- dev/prod still need `0008`; pre-check `select count(*) from customer.customers where
  responsible_operator_id is not null` before the deploy (`0` expected).
- Any developer whose volume predates AIS-18/AIS-177 will hit the same wall — §8.1 is the
  recipe, `down -v` + `db:up` the alternative.
