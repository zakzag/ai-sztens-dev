/**
 * Constants of the database-schema diagram generator (`pnpm db:diagram`).
 *
 * Data only — no I/O, no logic — so the parser
 * ([`schema-model.logic.mjs`](./schema-model.logic.mjs)) and the renderer
 * ([`schema-diagram.logic.mjs`](./schema-diagram.logic.mjs)) stay pure and
 * testable, and every path or literal is written down exactly once.
 *
 * @module scripts/db/schema-diagram.const
 */

/** The single source of truth: the Drizzle schema-as-code. */
export const SCHEMA_SOURCE_PATH = 'apps/api/src/db/schema.ts';

/** The generated living document (never edited by hand). */
export const DIAGRAM_DOCUMENT_PATH = 'docs/Specs/Database-Schema.md';

/**
 * The `**Utolsó frissítés:**` label the docs gate (`pnpm quality:docs`) looks
 * for in every `docs/Specs` document. It lives here because the generated
 * document must satisfy the gate.
 */
export const LAST_UPDATED_LABEL = 'Utolsó frissítés';

/** Placeholder that replaces the date in a `--check` comparison. */
export const DATE_PLACEHOLDER = '<date>';

/** Separator between the Postgres schema and the table inside a Mermaid entity name. */
export const ENTITY_SEPARATOR = '__';

/**
 * Mermaid `erDiagram` attribute types for the Drizzle column builders.
 *
 * A builder missing from this table falls back to its own name, so an unmapped
 * column renders as something readable instead of crashing the generator.
 */
export const TYPE_BY_BUILDER = Object.freeze({
  uuid: 'uuid',
  text: 'text',
  varchar: 'varchar',
  char: 'char',
  boolean: 'boolean',
  integer: 'integer',
  smallint: 'smallint',
  bigint: 'bigint',
  numeric: 'numeric',
  real: 'real',
  doublePrecision: 'double precision',
  json: 'json',
  jsonb: 'jsonb',
  date: 'date',
  time: 'time',
  interval: 'interval',
  bytea: 'bytea',
});

/**
 * The Postgres column type of a `timestamp()` builder.
 *
 * The schema always sets `withTimezone: true`, but the generator reads the
 * option instead of assuming it, so a future `timestamp(..., { withTimezone:
 * false })` column is documented truthfully.
 */
export const TIMESTAMP_WITH_TIME_ZONE = 'timestamptz';

/** The Postgres column type of a `timestamp(..., { withTimezone: false })`. */
export const TIMESTAMP_WITHOUT_TIME_ZONE = 'timestamp';

/** Default expression of `.defaultRandom()` on a `uuid` column. */
export const DEFAULT_RANDOM_EXPRESSION = 'gen_random_uuid()';

/** Default expression of `.defaultNow()`. */
export const DEFAULT_NOW_EXPRESSION = 'now()';

/** Exit codes of the CLI (`schema-diagram.mjs`). */
export const EXIT_CODES = Object.freeze({
  OK: 0,
  ERROR: 1,
  STALE: 2,
});

/** Log prefix of every CLI line, so a CI log is greppable. */
export const LOG_PREFIX = '[db:diagram]';

/** Column key vocabulary of the Mermaid entity blocks. */
export const MERMAID_KEYS = Object.freeze({
  PRIMARY: 'PK',
  FOREIGN: 'FK',
  UNIQUE: 'UK',
});
