# Database schema diagram: generated documentation from the Drizzle schema

**Date:** 2026-11-22 16:41
**Owner:** task-level request (AIS-14 branch)
**Related:** [`docs/Specs/Database-Schema.md`](../Specs/Database-Schema.md),
[`scripts/db/README.md`](../../scripts/db/README.md),
[`docs/history/2026-11-22--16-41-00-db-schema-diagram-generator.md`](../history/2026-11-22--16-41-00-db-schema-diagram-generator.md)

## 1. Problem / feature

The repository had no single artefact that showed **all** tables and their relations.
`Database-Local.md` describes the bootstrap and the grant matrix, and `schema.ts` is the
source of truth, but a reader had to reconstruct the ER model from code. Requested: a
`docs/Specs` document with a Mermaid diagram of every table and relationship, plus a script
that regenerates it at any time.

## 2. Evidence

- `apps/api/src/db/schema.ts` declares 3 Postgres schemas (`platform`, `customer`, `iam`),
  8 tables, 8 enum types and 8 foreign keys (6 column-level, 2 composite), plus partial
  unique indexes and one `CHECK`.
- Reading the file by hand is error-prone: the tables use a local builder factory
  (`createdAt()` / `updatedAt()` / `deletedAt()`), composite FKs whose target columns live in
  another table's object, and a migration bookkeeping table
  (`platform.__drizzle_migrations`) that is **not** part of `schema.ts`.

## 3. Design rationale

| Decision | Why |
| --- | --- |
| Parse the **schema source**, not a live database | Works offline and on a fresh checkout, needs no Postgres or migration state, and documents exactly what the migrations are generated from, so schema + diagram land in one commit. |
| Throw on an unknown construct instead of skipping it | A silently skipped table yields a diagram that looks complete while it is wrong — the worst failure mode for documentation. A regression test pins the real schema's table/relationship/enum counts. |
| Mermaid entity name = `<schema>__<table>` | A Mermaid `erDiagram` entity name cannot contain `.`. The mapping is stated in the document; the per-table sections keep the real dotted name. |
| Derived constraint name for column-level FKs | `.references()` does not name the constraint; Postgres derives `<table>_<column>_<target_table>_<target_column>_fk`. The document marks derived names with an asterisk; names written in the schema (composite FKs) are used verbatim. |
| `--check` ignores the date line | Otherwise CI would report the file stale every day the clock moved, and nobody would trust the gate. |
| Composite `foreignKey({ … })` resolution | The constraint sits on the table, not the column: without resolving it a join column would show `FK` with no target. |
| No third-party dependency, pure functions | Same shape as `scripts/quality/*`: parser and renderer are pure, deterministically tested, and `pnpm test:quality` runs them. |

## 4. Implementation

| File | Change |
| --- | --- |
| `docs/Specs/Database-Schema.md` | **Generated** living document: Mermaid ER diagram, per-table column and constraint tables, relationship list, enum catalogue, regeneration section. |
| `scripts/db/schema-diagram.mjs` | CLI: `--check` (exit 2 when stale), `--stdout`, `--date`; writes the document. |
| `scripts/db/schema-model.logic.mjs` | Pure parser: comment stripping, bracket matching, column/constraint extraction, builder-factory resolution, relationship derivation. |
| `scripts/db/schema-diagram.logic.mjs` | Pure renderer: Mermaid block, column/constraint/relationship/enum tables, `normalizeDocument` for `--check`. |
| `scripts/db/schema-diagram.const.mjs`, `schema-diagram.errors.mjs` | Constants and custom error classes. |
| `scripts/db/*.test.mjs`, `scripts/db/fixtures/schema.sample.ts` | 37 tests: every parser branch, the traps (commented-out column, `references(` inside a comment), renderer determinism, `--check` date normalisation, and a real-schema regression guard. |
| `package.json` | `db:diagram`, `db:diagram:check`; the db suites added to `test:quality`. |
| `knip.json` | `ignoreDependencies: ["drizzle-orm"]` — the only importer is in the excluded `apps/api` workspace, so the import would always read as unlisted against the root `package.json`. |
| `scripts/README.md`, `scripts/db/README.md`, `docs/Specs/Database-Local.md`, `docs/Specs/UI-Architecture.md` §9.2 | Script index, folder README, a pointer to the new document, and the knip exemption explained. |

## 5. Outcome and how to verify

```bash
pnpm db:diagram          # rewrites docs/Specs/Database-Schema.md
pnpm db:diagram:check    # exit 0 when up to date, 2 when stale
pnpm quality             # layers, knip, tokens, themes, field-errors, docs
```

Current state: `[db:diagram] wrote docs/Specs/Database-Schema.md — 8 tables, 8
relationships, 8 enums`; `--check` reports "is up to date"; the 37 suites pass;
`pnpm quality` is green (docs gate included, so the generated file satisfies the
`**Utolsó frissítés:**` and link rules).

Any future change to `schema.ts` must be followed by `pnpm db:diagram` in the same commit —
`Database-Local.md` §11 and the generated header both say so.

## 6. Follow-ups

- The parser understands only the constructs `schema.ts` uses today (`pgSchema`, `enum`,
  `table` with a column object and a constraint array, local builder factories). A new Drizzle
  feature needs a parser branch.
- `pnpm db:diagram:check` is not wired into CI; a single step in the quality job would make a
  stale diagram a red build.
- `platform.__drizzle_migrations` is documented as an explicit exclusion, not rendered.
