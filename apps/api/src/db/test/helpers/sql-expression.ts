/**
 * Test helper: renders a Drizzle default/expression value back to SQL text.
 *
 * Drizzle stores defaults as `SQL` wrapper objects whose `queryChunks` hold the
 * raw string parts (a `StringChunk` keeps its parts in `value`). Asserting on
 * the rendered text (`gen_random_uuid()`, `now()`) is the only way to prove the
 * *default expression* rather than just "some default exists", and it keeps the
 * spec free of hard-coded internals — everything unknown is narrowed here, in
 * one pure function, instead of leaking `any` into the tests.
 */

interface RecordLike {
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null;
}

function collectText(chunk: unknown): string {
  if (typeof chunk === 'string') {
    return chunk;
  }

  if (!isRecord(chunk)) {
    return '';
  }

  const { value, queryChunks } = chunk;

  if (Array.isArray(value)) {
    return value
      .filter((part): part is string => typeof part === 'string')
      .join('');
  }

  if (Array.isArray(queryChunks)) {
    return queryChunks.map(collectText).join('');
  }

  return '';
}

/**
 * Returns the SQL text of a column default or expression, whitespace-collapsed.
 *
 * @example readSqlExpression(apiKeys.id.default) // 'gen_random_uuid()'
 */
export function readSqlExpression(value: unknown): string {
  return collectText(value).replace(/\s+/g, ' ').trim();
}
