/**
 * Option objects of the schema factories in this folder.
 *
 * A factory takes an options object instead of positional arguments so a new
 * rule (a pattern, a required flag) can be added without breaking call sites —
 * the open/closed principle applied to validation rules.
 */

/** Upper bound of a free-text schema. */
export interface TextSchemaOptions {
  /** Maximum length **after** trimming. */
  readonly max: number;
}

/** Upper bound plus pattern of an identifier-like schema. */
export interface IdentifierSchemaOptions {
  /** Allowed shape; the length is part of the pattern. */
  readonly pattern: RegExp;
  /** Maximum length after trimming. */
  readonly max: number;
}
