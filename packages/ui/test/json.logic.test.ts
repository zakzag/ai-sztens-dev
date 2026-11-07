import { describe, expect, it } from 'vitest';
import { JSON_PRETTY_INDENT } from '../src/lib/json.const.js';
import { isJsonDetailValue, toPrettyJson } from '../src/lib/json.logic.js';

describe('toPrettyJson', () => {
  it('indents a flat object', () => {
    expect(toPrettyJson('{"name":"first"}')).toBe('{\n  "name": "first"\n}');
  });

  it('indents an array — the shape a query key has', () => {
    expect(toPrettyJson('["api-keys","update"]')).toBe(
      '[\n  "api-keys",\n  "update"\n]',
    );
  });

  it('indents nested containers', () => {
    expect(toPrettyJson('{"pagination":{"total":12}}')).toBe(
      '{\n  "pagination": {\n    "total": 12\n  }\n}',
    );
  });

  it('uses the shared indent width', () => {
    const pretty = toPrettyJson('{"a":1}') ?? '';

    expect(pretty).toContain(`${' '.repeat(JSON_PRETTY_INDENT)}"a"`);
  });

  it('normalises an already formatted payload', () => {
    expect(toPrettyJson('{"a":      1}')).toBe(toPrettyJson('{"a":1}'));
  });

  it('is deterministic across calls', () => {
    const value = '{"a":1,"b":[1,2]}';

    expect(toPrettyJson(value)).toBe(toPrettyJson(value));
  });

  it('never throws on a very long value', () => {
    expect(() => toPrettyJson(`{"a":"${'x'.repeat(10_000)}"}`)).not.toThrow();
  });

  const NOT_JSON: readonly (readonly [string, string])[] = [
    ['a number', '42'],
    ['a quoted string', '"x"'],
    ['true', 'true'],
    ['false', 'false'],
    ['null', 'null'],
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['plain text', 'POST /api/v1/keys'],
    ['a truncated object', '{"a":'],
  ];

  it.each(NOT_JSON)('returns null for %s', (_label, value) => {
    expect(toPrettyJson(value)).toBeNull();
  });
});

describe('isJsonDetailValue', () => {
  it('is true for a JSON container', () => {
    expect(isJsonDetailValue('["api-keys"]')).toBe(true);
    expect(isJsonDetailValue('{"code":"CONFLICT"}')).toBe(true);
  });

  it('is false for a primitive or for plain text', () => {
    expect(isJsonDetailValue('42')).toBe(false);
    expect(isJsonDetailValue('true')).toBe(false);
    expect(isJsonDetailValue('POST /api/v1/keys')).toBe(false);
  });
});
