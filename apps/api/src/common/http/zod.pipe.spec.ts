import { z } from 'zod';
import { API_ERROR_CODE, createApiKeySchema } from '@callback/shared';
import { ValidationAppError } from './app-error.js';
import { ZodBodyPipe, ZodQueryPipe } from './zod.pipe.js';

/**
 * The pipe is the only validation entry point for a shared schema, so the
 * behaviours worth guarding are: a valid payload is returned **parsed** (zod
 * transforms and strips unknown keys), an invalid one carries field paths — not
 * one concatenated sentence — and a schema that declares `.strict()` keeps the
 * old `forbidNonWhitelisted` behaviour (`400`, not a silent strip).
 */
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  limit: z.coerce.number().int().min(1).optional(),
});

/** A payload `createApiKeySchema` accepts. */
const VALID_CREATE_INPUT = {
  name: 'Vapi prod',
  identifier: 'vapi-prod',
  apiKey: 'sk-live-abcdef123456',
};

/**
 * @param run - the throwing call under test.
 * @returns the `ValidationAppError` it must throw.
 */
function caughtError(run: () => unknown): ValidationAppError {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationAppError) {
      return error;
    }

    throw error;
  }

  throw new Error('expected a ValidationAppError');
}

describe('ZodBodyPipe', () => {
  it('returns the parsed payload', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(pipe.transform({ name: 'Vapi' })).toEqual({ name: 'Vapi' });
  });

  it('strips unknown keys of a non-strict schema', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(pipe.transform({ name: 'Vapi', injected: true })).toEqual({
      name: 'Vapi',
    });
  });

  it('throws a ValidationAppError with the offending field path', () => {
    const pipe = new ZodBodyPipe(schema);

    const error = caughtError(() => pipe.transform({ name: '' }));

    expect(error.status).toBe(400);
    expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
    expect(error.details).toEqual([
      { path: 'name', message: 'Name is required' },
    ]);
  });

  it('rejects a field of the wrong type with its path', () => {
    const pipe = new ZodBodyPipe(schema);

    const error = caughtError(() => pipe.transform({ name: 42 }));

    expect(error.details[0]?.path).toBe('name');
  });

  it('reports a whole-payload failure with an empty path', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(caughtError(() => pipe.transform(null)).details[0]?.path).toBe('');
  });

  it('reports a missing body with an empty path', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(caughtError(() => pipe.transform(undefined)).details[0]?.path).toBe(
      '',
    );
  });

  it('rejects an undeclared key when the schema is strict', () => {
    // The old `forbidNonWhitelisted` behaviour lives in the **schema** now:
    // `createApiKeySchema` is `.strict()`, so a client-injected server-managed
    // field (`id`) is a 400 instead of being silently dropped.
    const pipe = new ZodBodyPipe(createApiKeySchema);

    const error = caughtError(() =>
      pipe.transform({ ...VALID_CREATE_INPUT, id: 'injected' }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
    expect(error.details[0]?.message).toContain('Unrecognized key');
  });

  it('accepts a payload the strict create schema declares', () => {
    const pipe = new ZodBodyPipe(createApiKeySchema);

    expect(pipe.transform(VALID_CREATE_INPUT)).toMatchObject({
      identifier: 'vapi-prod',
    });
  });
});

describe('ZodQueryPipe', () => {
  it('coerces a query string value', () => {
    const pipe = new ZodQueryPipe(schema);

    expect(pipe.transform({ name: 'Vapi', limit: '20' })).toEqual({
      name: 'Vapi',
      limit: 20,
    });
  });

  it('leaves an absent optional key absent', () => {
    const pipe = new ZodQueryPipe(schema);

    expect(pipe.transform({ name: 'Vapi' })).toEqual({ name: 'Vapi' });
  });

  it('rejects a value below the minimum with a field path', () => {
    const pipe = new ZodQueryPipe(schema);

    const error = caughtError(() =>
      pipe.transform({ name: 'Vapi', limit: '0' }),
    );

    expect(error.code).toBe(API_ERROR_CODE.VALIDATION_FAILED);
    expect(error.details[0]?.path).toBe('limit');
  });

  it('rejects a non-numeric value with the same field path', () => {
    const pipe = new ZodQueryPipe(schema);

    const error = caughtError(() =>
      pipe.transform({ name: 'Vapi', limit: 'abc' }),
    );

    expect(error.status).toBe(400);
    expect(error.details[0]?.path).toBe('limit');
  });
});
