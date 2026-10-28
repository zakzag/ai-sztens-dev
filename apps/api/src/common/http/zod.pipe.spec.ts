import { z } from 'zod';
import { ValidationAppError } from './app-error.js';
import { ZodBodyPipe, ZodQueryPipe } from './zod.pipe.js';

/**
 * The pipe is the only validation entry point for a shared schema, so the two
 * behaviours worth guarding are: a valid payload is returned **parsed** (zod
 * transforms and strips unknown keys), and an invalid one carries field paths —
 * not one concatenated sentence.
 */
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  limit: z.coerce.number().int().min(1).optional(),
});

describe('ZodBodyPipe', () => {
  it('returns the parsed payload', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(pipe.transform({ name: 'Vapi' })).toEqual({ name: 'Vapi' });
  });

  it('strips unknown keys instead of letting them through', () => {
    const pipe = new ZodBodyPipe(schema);

    expect(pipe.transform({ name: 'Vapi', injected: true })).toEqual({
      name: 'Vapi',
    });
  });

  it('throws a ValidationAppError with the offending field path', () => {
    const pipe = new ZodBodyPipe(schema);

    expect.assertions(3);

    try {
      pipe.transform({ name: '' });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationAppError);
      expect((error as ValidationAppError).status).toBe(400);
      expect((error as ValidationAppError).details).toEqual([
        { path: 'name', message: 'Name is required' },
      ]);
    }
  });

  it('reports a whole-payload failure with an empty path', () => {
    const pipe = new ZodBodyPipe(schema);

    expect.assertions(1);

    try {
      pipe.transform(null);
    } catch (error) {
      expect((error as ValidationAppError).details[0]?.path).toBe('');
    }
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

  it('rejects a value below the minimum with a field path', () => {
    const pipe = new ZodQueryPipe(schema);

    expect.assertions(2);

    try {
      pipe.transform({ name: 'Vapi', limit: '0' });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationAppError);
      expect((error as ValidationAppError).details[0]?.path).toBe('limit');
    }
  });
});
