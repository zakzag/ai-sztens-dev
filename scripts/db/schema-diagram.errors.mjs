/**
 * Error types of the database-schema diagram generator.
 *
 * Custom classes instead of bare `Error`s on purpose: the CLI decides its exit
 * code and its log line from the error type, so a "the schema file is missing"
 * case can never be confused with "the schema file could not be parsed".
 *
 * @module scripts/db/schema-diagram.errors
 */

/** Base class of every generator failure. */
export class SchemaDiagramError extends Error {
  /**
   * @param {string} message - human-readable, English developer text.
   * @param {object} [options] - standard `Error` options.
   * @param {unknown} [options.cause] - the low-level failure, when there is one.
   */
  constructor(message, options = {}) {
    super(message, options);

    this.name = new.target.name;
  }
}

/**
 * The Drizzle schema source could not be read.
 *
 * A missing file is a configuration problem (wrong working directory, a moved
 * schema), never a parse problem, and it must not look like the latter.
 */
export class SchemaSourceMissingError extends SchemaDiagramError {}

/**
 * The schema source is not shaped the way the parser expects.
 *
 * Raised with the offending offset or snippet, because a silent skip would
 * produce a diagram that looks complete while it is not — the worst possible
 * outcome for a documentation generator.
 */
export class SchemaParseError extends SchemaDiagramError {}
