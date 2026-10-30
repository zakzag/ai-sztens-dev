import { isUuid } from './uuid.js';

/**
 * Unit tests for the pure uuid guard (AIS-37).
 *
 * The valid list is what the API generates and receives; the invalid list covers
 * every way an id can be *almost* right — the shapes that would otherwise reach
 * Postgres and fail there with `22P02 invalid input syntax for type uuid`.
 */

describe('isUuid', () => {
  it.each([
    ['a v4 uuid', '3f0d1c2a-5b47-4a1e-9c6d-0e8b7a6f5d4c'],
    ['a v1 uuid', '2c5ea4c0-4067-11e9-8bad-9b1deb4d3b7d'],
    ['an uppercase uuid', '3F0D1C2A-5B47-4A1E-9C6D-0E8B7A6F5D4C'],
    ['a mixed-case uuid', '3f0D1C2a-5B47-4a1E-9C6D-0e8B7A6f5D4C'],
    ['the nil uuid', '00000000-0000-0000-0000-000000000000'],
    ['the max uuid', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
  ])('accepts %s', (_label, value) => {
    expect(isUuid(value)).toBe(true);
  });

  it.each([
    ['an empty string', ''],
    ['a blank string', '   '],
    ['a plain word', 'missing-id'],
    ['a numeric id', '12345'],
    ['a uuid without dashes', '3f0d1c2a5b474a1e9c6d0e8b7a6f5d4c'],
    ['a uuid with a missing group', '3f0d1c2a-5b47-4a1e-9c6d'],
    [
      'a uuid with a 11-character last group',
      '3f0d1c2a-5b47-4a1e-9c6d-0e8b7a6f5d4',
    ],
    [
      'a uuid with a 13-character last group',
      '3f0d1c2a-5b47-4a1e-9c6d-0e8b7a6f5d4c1',
    ],
    ['a uuid with a non-hex character', '3f0d1c2a-5b47-4a1e-9c6d-0e8b7a6f5dzz'],
    [
      'a uuid with surrounding whitespace',
      ' 3f0d1c2a-5b47-4a1e-9c6d-0e8b7a6f5d4c ',
    ],
    ['a uuid with braces', '{3f0d1c2a-5b47-4a1e-9c6d-0e8b7a6f5d4c}'],
    ['a sql-injection-shaped value', "' OR 1=1 --"],
  ])('rejects %s', (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });
});
