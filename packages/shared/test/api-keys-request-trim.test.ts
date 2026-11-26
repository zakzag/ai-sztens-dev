import {
  API_KEY_NAME_MAX_LENGTH,
  VALIDATION_MESSAGE_CATALOGUE,
  createApiKeySchema,
} from '../src/index.js';
import { firstMessage, parseIssues } from './lib/validation.helper.js';

/**
 * Behaviour changes introduced by AIS-112 plan decision `D6`.
 *
 * `createApiKeySchema` now normalises its text fields before validating them:
 * a name of spaces is a `400` instead of a stored `'   '`, and a padded value
 * is stored without the padding. These assertions are the contract of that
 * change — if the trimming is removed, the admin form and the API quietly start
 * disagreeing again.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;

const VALID_INPUT = {
  name: 'Prod kulcs',
  identifier: 'vapi-prod',
  apiKey: 'sk-live-abcdef',
} as const;

describe('createApiKeySchema normalisation', () => {
  it('accepts a plain payload', () => {
    expect(createApiKeySchema.safeParse(VALID_INPUT).success).toBe(true);
  });

  it('trims every text field before returning it', () => {
    const parsed = createApiKeySchema.parse({
      name: '  Prod kulcs  ',
      identifier: '  vapi-prod ',
      description: '  éles kulcs  ',
      apiKey: ' sk-live-abcdef ',
    });

    expect(parsed).toMatchObject({
      name: 'Prod kulcs',
      identifier: 'vapi-prod',
      description: 'éles kulcs',
      apiKey: 'sk-live-abcdef',
    });
  });

  it('rejects a name of spaces', () => {
    expect(
      firstMessage(createApiKeySchema, { ...VALID_INPUT, name: '   ' }),
    ).toBe(ENGLISH.REQUIRED);
  });

  it('rejects an api key of spaces', () => {
    expect(
      firstMessage(createApiKeySchema, { ...VALID_INPUT, apiKey: '   ' }),
    ).toBe(ENGLISH.REQUIRED);
  });

  it('rejects an identifier of spaces with the REQUIRED copy', () => {
    expect(
      firstMessage(createApiKeySchema, { ...VALID_INPUT, identifier: '   ' }),
    ).toBe(ENGLISH.REQUIRED);
  });

  it('rejects a name over the contract limit', () => {
    const issues = parseIssues(createApiKeySchema, {
      ...VALID_INPUT,
      name: 'a'.repeat(API_KEY_NAME_MAX_LENGTH + 1),
    });

    expect(issues[0]?.path).toBe('name');
    expect(issues[0]?.message).toContain(String(API_KEY_NAME_MAX_LENGTH));
  });

  it('still rejects an undeclared key', () => {
    const issues = parseIssues(createApiKeySchema, {
      ...VALID_INPUT,
      id: 'injected',
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toBe(ENGLISH.INVALID_FORMAT);
  });

  it('accepts an empty description, which the mapper then omits', () => {
    const parsed = createApiKeySchema.parse({
      ...VALID_INPUT,
      description: '   ',
    });

    expect(parsed.description).toBe('');
  });
});
