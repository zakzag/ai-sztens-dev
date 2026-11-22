# `scripts/db/` — database schema documentation

Generates the living database documentation
([`docs/Specs/Database-Schema.md`](../../docs/Specs/Database-Schema.md)) from the
Drizzle schema-as-code. The document contains a Mermaid `erDiagram` with every
table and relationship, plus a column table, the constraint/index list, the
relationship list and the enum catalogue per schema.

## Why it reads the source instead of the database

`apps/api/src/db/schema.ts` **is** the source of truth: the migrations are
generated from it, it exists on every checkout and in CI, and it is what the API
actually uses. Introspecting a live Postgres would require a running container, a
reachable network and an up-to-date migration state — and it would document a
database that can lag behind the code. Reading the file keeps the generator
offline, deterministic and reviewable: a schema change and its diagram land in
the same commit.

## Commands

```bash
pnpm db:diagram          # (re)write docs/Specs/Database-Schema.md
pnpm db:diagram:check    # verify only; exit 2 when the document is stale
```

Equivalent direct invocations, plus two extra flags that are useful while
debugging a schema change:

```bash
node scripts/db/schema-diagram.mjs              # same as pnpm db:diagram
node scripts/db/schema-diagram.mjs --check      # exit 0 up to date, 2 stale, 1 error
node scripts/db/schema-diagram.mjs --stdout     # print, do not write
node scripts/db/schema-diagram.mjs --date 2026-11-22   # pin the header date
```

`--check` ignores the `**Utolsó frissítés:**` date line, so a CI run does not
report a stale document merely because the clock moved on.

## Files

| File | Responsibility |
| --- | --- |
| [`schema-diagram.mjs`](schema-diagram.mjs) | CLI: argument parsing, file read/write, exit codes |
| [`schema-model.logic.mjs`](schema-model.logic.mjs) | Pure parser: source text → `{ schemas, enums, tables, relationships }` |
| [`schema-diagram.logic.mjs`](schema-diagram.logic.mjs) | Pure renderer: model → Markdown (Mermaid block, tables, lists) |
| [`schema-diagram.const.mjs`](schema-diagram.const.mjs) | Paths, spacing, labels, exit codes — data only |
| [`schema-diagram.errors.mjs`](schema-diagram.errors.mjs) | `SchemaDiagramError`, `SchemaSourceMissingError`, `SchemaParseError` |
| [`schema-model.logic.test.mjs`](schema-model.logic.test.mjs) | Parser tests over [`fixtures/schema.sample.ts`](fixtures/schema.sample.ts) and the real schema |
| [`schema-diagram.logic.test.mjs`](schema-diagram.logic.test.mjs) | Renderer, diagram and `--check` normalisation tests |

## What the parser understands

Only the constructs `schema.ts` actually uses, and it **throws** instead of
skipping an unknown shape — a silently skipped table would produce a diagram that
looks complete while it is not:

- `pgSchema('name')`, `<schema>.enum('type', TUPLE)` and the `[…] as const` value
  tuples the enum declarations point at;
- `<schema>.table('name', { …columns }, (table) => [ …constraints ])`;
- column builders: plain Drizzle builders, enum builders and local factories such
  as `function createdAt() { return timestamp(…) }`;
- column-level `.references(() => table.column, { onDelete })`;
- table-level `primaryKey`, `foreignKey`, `unique`, `uniqueIndex`, `index` and
  `check`, including composite column lists and partial-index `WHERE` clauses.

Column-level FK constraint names are **derived** (`<table>_<column>_<target>_<column>_fk`,
Postgres' default) because `.references()` does not name the constraint; composite
`foreignKey({ name: … })` names are used verbatim.

## Conventions

- No third-party dependency; Node ESM only, like the scripts under
  [`scripts/quality/`](../quality).
- The parser and the renderer are pure and unit-tested;
  `pnpm test:quality` runs their suites.
- The output is deterministic: the same schema always produces byte-identical
  text, so the diff of the documented file shows only real schema changes.
