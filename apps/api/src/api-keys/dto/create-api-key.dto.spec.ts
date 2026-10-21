import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_IDENTIFIER_MAX_LENGTH,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
} from '../api-keys.const.js';
import { CreateApiKeyDto } from './create-api-key.dto.js';

/**
 * Unit tests for the create DTO.
 *
 * `validate()` is called with the same options the global `ValidationPipe` uses
 * in `main.ts` (`whitelist` + `forbidNonWhitelisted`), because that combination
 * is what stops a client from injecting `id`, `createdAt` or `updatedAt` into
 * the insert.
 */

const VALIDATION_OPTIONS = {
  whitelist: true,
  forbidNonWhitelisted: true,
} as const;

/** @returns the property names that failed validation. */
async function invalidProperties(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(CreateApiKeyDto, payload);
  const errors = await validate(dto, VALIDATION_OPTIONS);
  return errors.map((error) => error.property);
}

/** @returns a copy of `payload` without the given key (the “omitted field” case). */
function without(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const copy = { ...payload };
  delete copy[key];
  return copy;
}

/** A minimal valid payload. */
const validPayload = {
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  description: 'primary',
  apiKey: 'tok_123',
  expiresAt: '2027-01-01T00:00:00.000Z',
};

describe('CreateApiKeyDto', () => {
  it('accepts a fully populated payload', async () => {
    await expect(invalidProperties(validPayload)).resolves.toEqual([]);
  });

  it('accepts a payload without the optional fields', async () => {
    await expect(
      invalidProperties({
        name: 'Vapi prod',
        identifier: 'vapi-prod',
        apiKey: 'tok_123',
      }),
    ).resolves.toEqual([]);
  });

  it('rejects a missing name', async () => {
    await expect(
      invalidProperties(without(validPayload, 'name')),
    ).resolves.toContain('name');
  });

  it('rejects an empty name', async () => {
    await expect(
      invalidProperties({ ...validPayload, name: '' }),
    ).resolves.toContain('name');
  });

  it('rejects a name longer than the limit', async () => {
    await expect(
      invalidProperties({
        ...validPayload,
        name: 'a'.repeat(API_KEY_NAME_MAX_LENGTH + 1),
      }),
    ).resolves.toContain('name');
  });

  it('rejects a number instead of a name', async () => {
    await expect(
      invalidProperties({ ...validPayload, name: 42 }),
    ).resolves.toContain('name');
  });

  it('rejects a missing identifier', async () => {
    await expect(
      invalidProperties(without(validPayload, 'identifier')),
    ).resolves.toContain('identifier');
  });

  it('rejects an empty identifier', async () => {
    await expect(
      invalidProperties({ ...validPayload, identifier: '' }),
    ).resolves.toContain('identifier');
  });

  it('rejects an identifier containing a slash', async () => {
    await expect(
      invalidProperties({ ...validPayload, identifier: 'vapi/prod' }),
    ).resolves.toContain('identifier');
  });

  it('rejects an identifier containing a space', async () => {
    await expect(
      invalidProperties({ ...validPayload, identifier: 'vapi prod' }),
    ).resolves.toContain('identifier');
  });

  it('rejects an identifier longer than the limit', async () => {
    await expect(
      invalidProperties({
        ...validPayload,
        identifier: 'a'.repeat(API_KEY_IDENTIFIER_MAX_LENGTH + 1),
      }),
    ).resolves.toContain('identifier');
  });

  it('accepts an identifier using dot, dash and underscore', async () => {
    await expect(
      invalidProperties({ ...validPayload, identifier: 'vapi.prod_test-1' }),
    ).resolves.toEqual([]);
  });

  it('rejects a missing apiKey', async () => {
    await expect(
      invalidProperties(without(validPayload, 'apiKey')),
    ).resolves.toContain('apiKey');
  });

  it('rejects an empty apiKey', async () => {
    await expect(
      invalidProperties({ ...validPayload, apiKey: '' }),
    ).resolves.toContain('apiKey');
  });

  it('rejects an apiKey longer than the limit', async () => {
    await expect(
      invalidProperties({
        ...validPayload,
        apiKey: 'a'.repeat(API_KEY_VALUE_MAX_LENGTH + 1),
      }),
    ).resolves.toContain('apiKey');
  });

  it('rejects a description longer than the limit', async () => {
    await expect(
      invalidProperties({
        ...validPayload,
        description: 'a'.repeat(API_KEY_DESCRIPTION_MAX_LENGTH + 1),
      }),
    ).resolves.toContain('description');
  });

  it('rejects a non-string description', async () => {
    await expect(
      invalidProperties({ ...validPayload, description: 12 }),
    ).resolves.toContain('description');
  });

  it('rejects a malformed expiresAt', async () => {
    await expect(
      invalidProperties({ ...validPayload, expiresAt: '2027-13-45' }),
    ).resolves.toContain('expiresAt');
  });

  it('rejects a non-ISO expiresAt', async () => {
    await expect(
      invalidProperties({ ...validPayload, expiresAt: 'next year' }),
    ).resolves.toContain('expiresAt');
  });

  it('rejects unknown fields so server-managed columns cannot be injected', async () => {
    await expect(
      invalidProperties({
        ...validPayload,
        id: '3f8a1d2e-0000-4000-8000-00000000abcd',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      }),
    ).resolves.toEqual(
      expect.arrayContaining(['id', 'createdAt', 'updatedAt']),
    );
  });
});
