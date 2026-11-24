/**
 * Parser of the Drizzle schema source — pure, no filesystem access.
 *
 * The generator deliberately reads **the schema-as-code** instead of
 * introspecting a live database: the file is the single source of truth
 * (migrations are generated from it), it exists on every checkout and in CI,
 * and the diagram therefore needs neither a running Postgres nor a network.
 *
 * The parser understands exactly the constructs `apps/api/src/db/schema.ts`
 * uses — `pgSchema()`, `<schema>.enum()`, `<schema>.table()` with a column
 * object and a constraint array — and **throws** on anything else instead of
 * skipping it. A silently skipped table would produce a diagram that looks
 * complete while it is not, which is worse than a failed run.
 *
 * Everything here is a pure function of the source string, so every branch is
 * provable by a fixture in
 * [`schema-model.logic.test.mjs`](./schema-model.logic.test.mjs).
 *
 * @module scripts/db/schema-model.logic
 */

import {
  DEFAULT_NOW_EXPRESSION,
  DEFAULT_RANDOM_EXPRESSION,
  TIMESTAMP_WITH_TIME_ZONE,
  TIMESTAMP_WITHOUT_TIME_ZONE,
  TYPE_BY_BUILDER,
} from './schema-diagram.const.mjs';
import { SchemaParseError } from './schema-diagram.errors.mjs';

/** Constraint kinds the parser recognises. */
export const CONSTRAINT_KINDS = Object.freeze({
  PRIMARY_KEY: 'primary-key',
  UNIQUE: 'unique',
  UNIQUE_INDEX: 'unique-index',
  INDEX: 'index',
  CHECK: 'check',
  FOREIGN_KEY: 'foreign-key',
});

/**
 * Declarations in the schema file, in the order the parser looks for them.
 *
 * `pgSchema` first (the tables need it), then the enum value tuples (the enum
 * declarations point at them), then the enums, then the tables.
 */
const PG_SCHEMA_PATTERN =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*pgSchema\(\s*'([^']+)'\s*\)/g;

const ENUM_TUPLE_PATTERN =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*\[([\s\S]*?)\]\s*as\s+const/g;

const ENUM_DECLARATION_PATTERN =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.enum\(\s*'([^']+)'\s*,\s*([A-Za-z_$][\w$]*)\s*,?\s*\)/g;

/**
 * A local column-builder factory: `function createdAt() { return timestamp(…) }`.
 *
 * The schema wraps the repeated timestamp trio in such a factory, so a column's
 * builder identifier is not always a Drizzle builder name. Resolving the factory
 * keeps the documented type and column name truthful instead of printing
 * `createdAt createdAt`.
 */
const BUILDER_FACTORY_PATTERN =
  /function\s+([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\{/g;

const TABLE_DECLARATION_PATTERN =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.table\(/g;

/** The table-level builders the constraint array may contain. */
const CONSTRAINT_CALL_PATTERN =
  /\b(primaryKey|uniqueIndex|unique|index|check|foreignKey)\(/g;

/**
 * Tells whether a character opens a string literal.
 *
 * @param {string} char - one character.
 * @returns {boolean} `true` for `'`, `"` and `` ` ``.
 */
function isQuote(char) {
  return char === "'" || char === '"' || char === '`';
}

/**
 * Replaces every comment with spaces, keeping line and offset positions intact.
 *
 * Offsets and line numbers of the remaining code must not shift, because the
 * error messages quote positions; that is why a comment becomes blanks instead
 * of disappearing. String literals are honoured, so the `//` inside a URL or a
 * `/*` inside a template literal is content, not a comment.
 *
 * @param {string} source - raw TypeScript source.
 * @returns {string} the same source with every comment blanked out.
 */
export function stripComments(source) {
  let output = '';
  /** @type {string | null} */
  let quote = null;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quote !== null) {
      output += char;

      if (char === '\\') {
        output += source[index + 1] ?? '';
        index += 1;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (isQuote(char)) {
      quote = char;
      output += char;
      continue;
    }

    const isLineComment = char === '/' && source[index + 1] === '/';
    const isBlockComment = char === '/' && source[index + 1] === '*';

    if (isLineComment) {
      output += '  ';
      index += 2;

      while (index < source.length && source[index] !== '\n') {
        output += ' ';
        index += 1;
      }

      if (index < source.length) {
        output += '\n';
      }

      continue;
    }

    if (isBlockComment) {
      output += '  ';
      index += 2;

      while (
        index < source.length &&
        !(source[index] === '*' && source[index + 1] === '/')
      ) {
        output += source[index] === '\n' ? '\n' : ' ';
        index += 1;
      }

      output += '  ';
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

/**
 * Finds the index of the bracket that closes the one at `openIndex`.
 *
 * Only the same bracket pair is counted, and string literals are skipped, so a
 * `)` inside a template literal or a nested object cannot end the region early.
 *
 * @param {string} text - the scanned text (comment-free).
 * @param {number} openIndex - index of `(`, `{` or `[`.
 * @returns {number} index of the matching closing bracket.
 * @throws {SchemaParseError} when the bracket is unbalanced.
 */
export function findClosing(text, openIndex) {
  const open = text[openIndex];
  const close = open === '(' ? ')' : open === '{' ? '}' : open === '[' ? ']' : null;

  if (close === null) {
    throw new SchemaParseError(
      `expected an opening bracket at offset ${openIndex}, found "${open ?? ''}"`,
    );
  }

  let depth = 0;
  /** @type {string | null} */
  let quote = null;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];

    if (quote !== null) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (isQuote(char)) {
      quote = char;
      continue;
    }

    if (char === open) {
      depth += 1;
      continue;
    }

    if (char === close) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  throw new SchemaParseError(
    `unbalanced "${open}" starting at offset ${openIndex}`,
  );
}

/**
 * Splits a comma separated list at bracket depth zero.
 *
 * A column object entry, a constraint argument and a column-reference list all
 * have the same problem: nested calls contain commas that must not split the
 * list. String literals are skipped for the same reason.
 *
 * @param {string} text - the text to split (comment-free).
 * @param {string} [separator] - the separator character, `,` by default.
 * @returns {Array<string>} the parts, untrimmed and in source order.
 */
export function splitTopLevel(text, separator = ',') {
  const parts = [];
  let depth = 0;
  /** @type {string | null} */
  let quote = null;
  let start = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quote !== null) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (isQuote(char)) {
      quote = char;
      continue;
    }

    if (char === '(' || char === '{' || char === '[') {
      depth += 1;
      continue;
    }

    if (char === ')' || char === '}' || char === ']') {
      depth -= 1;
      continue;
    }

    if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(text.slice(start));

  return parts;
}

/**
 * Collapses every whitespace run into a single space and trims the ends.
 *
 * Used for SQL fragments lifted out of the schema (a `WHERE` predicate, a
 * `CHECK` expression), which are multi-line in the source but one cell in the
 * generated table.
 *
 * @param {string} text - raw fragment.
 * @returns {string} the fragment on one line.
 */
export function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Reads the string literals of a TypeScript array body.
 *
 * @param {string} body - the text between `[` and `]`.
 * @returns {Array<string>} the literal values, in order.
 */
export function readStringLiterals(body) {
  const values = [];

  for (const match of body.matchAll(/'([^']*)'/g)) {
    values.push(match[1]);
  }

  return values;
}

/**
 * Reads a `{ a: 1, b: 2 }` object body into its raw property entries.
 *
 * @param {string} body - the text between `{` and `}`.
 * @returns {Map<string, string>} property name → raw value text.
 */
export function readObjectProperties(body) {
  const properties = new Map();
  const trimmed = body.trim();
  const inner =
    trimmed.startsWith('{') && trimmed.endsWith('}')
      ? trimmed.slice(1, -1)
      : trimmed;

  for (const entry of splitTopLevel(inner)) {
    const match = /^\s*([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+?)\s*$/.exec(entry);

    if (match !== null) {
      properties.set(match[1], match[2]);
    }
  }

  return properties;
}

/**
 * Reads a `[table.a, other.b]` reference list.
 *
 * @param {string} body - the text between `[` and `]`.
 * @returns {Array<{ exportName: string, propertyName: string }>} the refs.
 */
export function readColumnReferences(body) {
  const trimmed = body.trim();
  const inner =
    trimmed.startsWith('[') && trimmed.endsWith(']')
      ? trimmed.slice(1, -1)
      : trimmed;

  return splitTopLevel(inner)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const match = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/.exec(entry);

      return match === null
        ? { exportName: entry, propertyName: entry }
        : { exportName: match[1], propertyName: match[2] };
    });
}

/**
 * Collects the `pgSchema()` declarations.
 *
 * @param {string} source - comment-free source.
 * @returns {Map<string, string>} exported identifier → Postgres schema name.
 */
export function parseSchemaDeclarations(source) {
  const schemas = new Map();

  for (const match of source.matchAll(PG_SCHEMA_PATTERN)) {
    schemas.set(match[1], match[2]);
  }

  return schemas;
}

/**
 * Collects the `[…] as const` value tuples the enum declarations refer to.
 *
 * @param {string} source - comment-free source.
 * @returns {Map<string, Array<string>>} exported identifier → literal values.
 */
export function parseEnumTuples(source) {
  const tuples = new Map();

  for (const match of source.matchAll(ENUM_TUPLE_PATTERN)) {
    tuples.set(match[1], readStringLiterals(match[2]));
  }

  return tuples;
}

/**
 * Collects the `pgSchema.enum()` declarations.
 *
 * @param {string} source - comment-free source.
 * @param {Map<string, string>} schemas - result of `parseSchemaDeclarations`.
 * @param {Map<string, Array<string>>} tuples - result of `parseEnumTuples`.
 * @returns {Array<object>} `{ exportName, schema, name, values }` entries.
 */
export function parseEnumDeclarations(source, schemas, tuples) {
  const enums = [];

  for (const match of source.matchAll(ENUM_DECLARATION_PATTERN)) {
    const [, exportName, schemaIdent, name, tupleIdent] = match;

    enums.push({
      exportName,
      schema: schemas.get(schemaIdent) ?? schemaIdent,
      name,
      values: tuples.get(tupleIdent) ?? [],
    });
  }

  return enums;
}

/**
 * Turns a column builder into the Postgres type printed in the document.
 *
 * An enum builder resolves to the enum's SQL type name (`customer_type`), a
 * known builder resolves through `TYPE_BY_BUILDER`, and anything else keeps its
 * own name so an unmapped builder is visible instead of silently wrong.
 *
 * @param {string} builder - builder identifier, e.g. `uuid` or `customerTypeEnum`.
 * @param {string} chain - the whole builder chain, for the timestamp option.
 * @param {Map<string, object>} enumsByExport - enum identifier → declaration.
 * @returns {string} the SQL type.
 */
export function resolveColumnType(builder, chain, enumsByExport) {
  const enumDeclaration = enumsByExport.get(builder);

  if (enumDeclaration !== undefined) {
    return enumDeclaration.name;
  }

  if (builder === 'timestamp') {
    return /withTimezone:\s*false/.test(chain)
      ? TIMESTAMP_WITHOUT_TIME_ZONE
      : TIMESTAMP_WITH_TIME_ZONE;
  }

  return TYPE_BY_BUILDER[builder] ?? (builder === '' ? 'unknown' : builder);
}

/**
 * Reads the `.default(…)` argument of a column chain.
 *
 * @param {string} chain - the builder chain.
 * @returns {string | null} the default expression, or `null` when there is none.
 */
export function resolveDefaultValue(chain) {
  if (/\.defaultRandom\(\)/.test(chain)) {
    return DEFAULT_RANDOM_EXPRESSION;
  }

  if (/\.defaultNow\(\)/.test(chain)) {
    return DEFAULT_NOW_EXPRESSION;
  }

  const index = chain.indexOf('.default(');

  if (index === -1) {
    return null;
  }

  const open = index + '.default'.length;
  const close = findClosing(chain, open);

  return collapseWhitespace(chain.slice(open + 1, close));
}

/**
 * Reads the `.references(() => table.column, { onDelete })` of a column chain.
 *
 * @param {string} chain - the builder chain.
 * @returns {{ exportName: string, propertyName: string, onDelete: string | null } | null}
 *   the reference, or `null` when the column has none.
 */
export function parseColumnReference(chain) {
  const match =
    /\.references\(\s*\(\s*\)\s*=>\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/.exec(
      chain,
    );

  if (match === null) {
    return null;
  }

  return {
    exportName: match[1],
    propertyName: match[2],
    onDelete: /onDelete:\s*'([^']+)'/.exec(chain)?.[1] ?? null,
  };
}

/**
 * Parses one entry of a column object.
 *
 * @param {string} entry - e.g. `id: uuid('id').primaryKey().defaultRandom()`.
 * @param {Map<string, object>} enumsByExport - enum identifier → declaration.
 * @param {Map<string, { builder: string, chain: string }>} [builderFactories] -
 *   local `function x() { return builder(…) }` declarations.
 * @returns {object} the column model.
 * @throws {SchemaParseError} when the entry is not a `name: builder` pair.
 */
export function parseColumn(entry, enumsByExport, builderFactories = new Map()) {
  const head = /^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/.exec(entry.trim());

  if (head === null) {
    throw new SchemaParseError(
      `unsupported column entry: ${collapseWhitespace(entry).slice(0, 80)}`,
    );
  }

  const [, propertyName, ownChain] = head;
  const builder = /^([A-Za-z_$][\w$]*)\s*\(/.exec(ownChain)?.[1] ?? '';
  const factory = builderFactories.get(builder);

  // A factory column keeps only the chained calls it adds on top of the
  // factory's own chain (`createdAt()` contributes nothing).
  const ownTail = ownChain.slice(builder.length).replace(/^\(\s*\)/, '');
  const chain = factory === undefined ? ownChain : `${factory.chain}${ownTail}`;

  const isPrimaryKey = /\.primaryKey\(\)/.test(chain);

  return {
    propertyName,
    name: /\(\s*'([^']+)'/.exec(chain)?.[1] ?? propertyName,
    type: resolveColumnType(
      factory?.builder ?? builder,
      chain,
      enumsByExport,
    ),
    // `primaryKey()` implies `NOT NULL` in Postgres, whether or not the chain
    // repeats `.notNull()`, so the document must not claim the column is
    // nullable.
    isNotNull: /\.notNull\(\)/.test(chain) || isPrimaryKey,
    isPrimaryKey,
    defaultValue: resolveDefaultValue(chain),
    reference: parseColumnReference(chain),
  };
}

/**
 * Collects the local column-builder factories of the schema file.
 *
 * @param {string} source - comment-free source.
 * @returns {Map<string, { builder: string, chain: string }>} factory name →
 *   the builder it wraps and the whole chain it returns.
 */
export function parseBuilderFactories(source) {
  const factories = new Map();

  for (const match of source.matchAll(BUILDER_FACTORY_PATTERN)) {
    const open = match.index + match[0].length - 1;
    const close = findClosing(source, open);
    const body = source.slice(open + 1, close);
    const returned = /\breturn\s+([A-Za-z_$][\w$]*)\s*\(/.exec(body);

    if (returned === null) {
      continue;
    }

    const statement = body
      .slice(returned.index)
      .trim()
      .replace(/^return\s+/, '');

    factories.set(match[1], {
      builder: returned[1],
      chain: splitTopLevel(statement, ';')[0].trim(),
    });
  }

  return factories;
}

/**
 * Reads the consecutive `.name(args)` calls that follow a builder call.
 *
 * `unique('x').on(table.y).where(sql\`…\`)` is one table-level builder split in
 * three chained calls; this helper returns them in order so the caller does not
 * need a regex per shape.
 *
 * @param {string} text - comment-free text.
 * @param {number} startIndex - index right after the closing parenthesis.
 * @returns {Array<{ name: string, args: string }>} the chained calls.
 */
export function readChainedCalls(text, startIndex) {
  const calls = [];
  let index = startIndex;

  for (;;) {
    while (index < text.length && /\s/.test(text[index])) {
      index += 1;
    }

    if (text[index] !== '.') {
      return calls;
    }

    const match = /^\.([A-Za-z_$][\w$]*)\s*\(/.exec(text.slice(index));

    if (match === null) {
      return calls;
    }

    const open = index + match[0].length - 1;
    const close = findClosing(text, open);

    calls.push({ name: match[1], args: text.slice(open + 1, close) });
    index = close + 1;
  }
}

/**
 * Builds one table-level constraint record.
 *
 * `expression` is the constraint's own SQL (a `CHECK` body or an index over an
 * expression such as `lower(email)`), while `predicate` is the optional
 * `WHERE` clause of a partial unique index. They are separate because a reader
 * needs to know which one limits the index and which one defines it.
 *
 * @param {object} args - parsed pieces.
 * @param {string} args.kind - one of `CONSTRAINT_KINDS`.
 * @param {string} args.name - constraint or index name.
 * @param {Array<{ exportName: string, propertyName: string }>} [args.columns] - local columns.
 * @param {Array<{ exportName: string, propertyName: string }>} [args.foreignColumns] - target columns.
 * @param {string | null} [args.expression] - a `CHECK` body or an index expression.
 * @param {string | null} [args.predicate] - the `WHERE` clause of a partial index.
 * @param {string | null} [args.onDelete] - the `ON DELETE` action of a foreign key.
 * @returns {object} the constraint model.
 */
function toConstraint({
  kind,
  name,
  columns = [],
  foreignColumns = [],
  expression = null,
  predicate = null,
  onDelete = null,
}) {
  return {
    kind,
    name,
    columns,
    foreignColumns,
    expression,
    predicate,
    onDelete,
  };
}

/**
 * Reads an index column list, or the index expression when it is not one.
 *
 * `.on(table.email)` is a column list; `.on(sql\`lower(${table.email})\`)` is an
 * expression, and printing it in the column cell would produce a nonsense
 * column name.
 *
 * @param {string} argsText - the `.on(…)` arguments.
 * @returns {{ columns: Array<{ exportName: string, propertyName: string }>, expression: string | null }}
 *   either the column references or the raw expression.
 */
export function readIndexTarget(argsText) {
  const entries = splitTopLevel(argsText)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const isColumnList =
    entries.length > 0 &&
    entries.every((entry) =>
      /^[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*$/.test(entry),
    );

  return isColumnList
    ? { columns: readColumnReferences(argsText), expression: null }
    : { columns: [], expression: argsText };
}

/**
 * Parses the constraint array of a table definition.
 *
 * @param {string} extrasText - everything after the column object inside `.table(…)`.
 * @returns {Array<object>} the constraints, indexes and checks in source order.
 * @throws {SchemaParseError} when a recognised builder is malformed.
 */
export function parseTableConstraints(extrasText) {
  const constraints = [];

  for (const match of extrasText.matchAll(CONSTRAINT_CALL_PATTERN)) {
    const kind = match[1];
    const open = match.index + match[0].length - 1;
    const close = findClosing(extrasText, open);
    const args = extrasText.slice(open + 1, close);
    const chained = readChainedCalls(extrasText, close + 1);
    const chainedArgs = (name) =>
      chained.find((call) => call.name === name)?.args ?? null;

    if (kind === 'primaryKey' || kind === 'foreignKey') {
      const properties = readObjectProperties(args);
      const columns = readColumnReferences(properties.get('columns') ?? '');
      const foreignColumns = readColumnReferences(
        properties.get('foreignColumns') ?? '',
      );

      constraints.push(
        toConstraint({
          kind:
            kind === 'primaryKey'
              ? CONSTRAINT_KINDS.PRIMARY_KEY
              : CONSTRAINT_KINDS.FOREIGN_KEY,
          name: /'([^']+)'/.exec(properties.get('name') ?? '')?.[1] ?? '',
          columns,
          foreignColumns,
          onDelete:
            /'([^']+)'/.exec(chainedArgs('onDelete') ?? '')?.[1] ?? null,
        }),
      );

      continue;
    }

    if (kind === 'check') {
      const [namePart = '', expressionPart = ''] = splitTopLevel(args);

      constraints.push(
        toConstraint({
          kind: CONSTRAINT_KINDS.CHECK,
          name: /'([^']+)'/.exec(namePart)?.[1] ?? '',
          expression: collapseWhitespace(expressionPart),
        }),
      );

      continue;
    }

    // `unique`, `uniqueIndex` and `index` share one shape:
    // `name('x').on(columns…)` and, for a partial unique index, `.where(…)`.
    const target = readIndexTarget(chainedArgs('on') ?? '');

    constraints.push(
      toConstraint({
        kind: CONSTRAINT_KINDS[
          kind === 'unique'
            ? 'UNIQUE'
            : kind === 'uniqueIndex'
              ? 'UNIQUE_INDEX'
              : 'INDEX'
        ],
        name: /^\s*'([^']+)'/.exec(args)?.[1] ?? '',
        columns: target.columns,
        expression: target.expression,
        predicate: chainedArgs('where') ?? null,
      }),
    );
  }

  return constraints;
}

/**
 * Parses one `pgSchema.table()` declaration into a table model.
 *
 * @param {string} source - comment-free source.
 * @param {RegExpMatchArray} match - a `TABLE_DECLARATION_PATTERN` match.
 * @param {object} context - lookups (`schemas`, `enumsByExport`, `builderFactories`).
 * @returns {object} the table model.
 * @throws {SchemaParseError} when the declaration is malformed.
 */
function parseTableDeclaration(source, match, context) {
  const [, exportName, schemaIdent] = match;
  const openParen = match.index + match[0].length - 1;
  const closeParen = findClosing(source, openParen);
  const call = source.slice(openParen + 1, closeParen);
  const nameMatch = /^\s*'([^']+)'/.exec(call);

  if (nameMatch === null) {
    throw new SchemaParseError(`table "${exportName}" has no name literal`);
  }

  const columnsOpen = call.indexOf('{', nameMatch[0].length);

  if (columnsOpen === -1) {
    throw new SchemaParseError(
      `table "${exportName}" has no column object`,
    );
  }

  const columnsClose = findClosing(call, columnsOpen);
  const columnsText = call.slice(columnsOpen + 1, columnsClose);
  const extrasText = call.slice(columnsClose + 1);

  const columns = splitTopLevel(columnsText)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) =>
      parseColumn(entry, context.enumsByExport, context.builderFactories),
    );

  return {
    exportName,
    schema: context.schemas.get(schemaIdent) ?? schemaIdent,
    name: nameMatch[1],
    columns,
    constraints: parseTableConstraints(extrasText),
  };
}

/**
 * Collects every table declaration.
 *
 * @param {string} source - comment-free source.
 * @param {object} context - lookups (`schemas`, `enumsByExport`, `builderFactories`).
 * @returns {Array<object>} the table models, in source order.
 */
export function parseTables(source, context) {
  const tables = [];

  for (const match of source.matchAll(TABLE_DECLARATION_PATTERN)) {
    tables.push(parseTableDeclaration(source, match, context));
  }

  return tables;
}

/**
 * Finds a column of a table by its TypeScript property name.
 *
 * @param {object} table - the table model.
 * @param {string} propertyName - e.g. `customerId`.
 * @returns {object | undefined} the column model.
 */
export function findColumnByProperty(table, propertyName) {
  return table.columns.find((column) => column.propertyName === propertyName);
}

/**
 * Maps a property-reference list to database column names.
 *
 * @param {object} table - the table the properties belong to.
 * @param {Array<{ propertyName: string }>} references - the refs to resolve.
 * @returns {Array<string>} the database column names, unresolved refs verbatim.
 */
export function toColumnNames(table, references) {
  return references.map(
    (reference) =>
      findColumnByProperty(table, reference.propertyName)?.name ??
      reference.propertyName,
  );
}

/**
 * Derives the relationships of the model.
 *
 * Two shapes exist in the schema and both are documented:
 *
 * - a **column-level** `.references()` — the constraint name is the Postgres
 *   default `<table>_<column>_<target_table>_<target_column>_fk`, which is why
 *   it is marked as derived;
 * - a **composite** `foreignKey({ … })` — the name is written in the schema and
 *   is used verbatim.
 *
 * @param {Array<object>} tables - the table models.
 * @returns {Array<object>} the relationship models, in source order.
 */
export function buildRelationships(tables) {
  const byExport = new Map(tables.map((table) => [table.exportName, table]));
  const relationships = [];

  for (const table of tables) {
    for (const column of table.columns) {
      const reference = column.reference;

      if (reference === null) {
        continue;
      }

      const target = byExport.get(reference.exportName);

      if (target === undefined) {
        continue;
      }

      const targetColumn =
        findColumnByProperty(target, reference.propertyName)?.name ??
        reference.propertyName;

      relationships.push({
        kind: 'column',
        name: `${table.name}_${column.name}_${target.name}_${targetColumn}_fk`,
        nameIsDerived: true,
        from: table,
        fromColumns: [column.name],
        to: target,
        toColumns: [targetColumn],
        onDelete: reference.onDelete,
      });
    }

    for (const constraint of table.constraints) {
      if (constraint.kind !== CONSTRAINT_KINDS.FOREIGN_KEY) {
        continue;
      }

      const target = byExport.get(
        constraint.foreignColumns[0]?.exportName ?? '',
      );

      if (target === undefined) {
        continue;
      }

      relationships.push({
        kind: 'composite',
        name: constraint.name,
        nameIsDerived: false,
        from: table,
        fromColumns: toColumnNames(table, constraint.columns),
        to: target,
        toColumns: toColumnNames(target, constraint.foreignColumns),
        onDelete: constraint.onDelete,
      });
    }
  }

  return relationships;
}

/**
 * Marks the key columns of every table on the model.
 *
 * Mermaid needs the `PK`/`FK`/`UK` markers on the attribute line, and a column
 * may carry several at once (a join table's columns are `PK, FK`). The flags
 * therefore live on the table model as three name lists and are turned into
 * markers only by the renderer.
 *
 * @param {Array<object>} tables - the table models, mutated in place.
 * @returns {void}
 */
export function markKeyColumns(tables) {
  for (const table of tables) {
    const primaryKey = new Set(
      table.columns
        .filter((column) => column.isPrimaryKey)
        .map((column) => column.name),
    );
    const unique = new Set();
    const foreignKey = new Set(
      table.columns
        .filter((column) => column.reference !== null)
        .map((column) => column.name),
    );

    for (const constraint of table.constraints) {
      if (constraint.kind === CONSTRAINT_KINDS.PRIMARY_KEY) {
        toColumnNames(table, constraint.columns).forEach((name) =>
          primaryKey.add(name),
        );
      }

      // A composite unique constraint does not make any of its columns unique
      // on its own, so only a single-column one earns the `UK` marker; the
      // composite pair is documented in the constraint table instead.
      if (
        (constraint.kind === CONSTRAINT_KINDS.UNIQUE ||
          constraint.kind === CONSTRAINT_KINDS.UNIQUE_INDEX) &&
        constraint.columns.length === 1
      ) {
        toColumnNames(table, constraint.columns).forEach((name) =>
          unique.add(name),
        );
      }

      if (constraint.kind === CONSTRAINT_KINDS.FOREIGN_KEY) {
        toColumnNames(table, constraint.columns).forEach((name) =>
          foreignKey.add(name),
        );
      }
    }

    table.primaryKeyColumns = [...primaryKey];
    table.uniqueColumns = [...unique];
    table.foreignKeyColumns = [...foreignKey];
  }
}

/**
 * Builds the whole model from the schema source.
 *
 * @param {string} source - the raw `apps/api/src/db/schema.ts` text.
 * @returns {object} `{ schemas, enums, tables, relationships }`.
 */
export function buildSchemaModel(source) {
  const clean = stripComments(source);
  const schemas = parseSchemaDeclarations(clean);
  const tuples = parseEnumTuples(clean);
  const enums = parseEnumDeclarations(clean, schemas, tuples);
  const tables = parseTables(clean, {
    schemas,
    enumsByExport: new Map(enums.map((entry) => [entry.exportName, entry])),
    builderFactories: parseBuilderFactories(clean),
  });

  markKeyColumns(tables);

  return {
    schemas: [...schemas.values()],
    enums,
    tables,
    relationships: buildRelationships(tables),
  };
}
