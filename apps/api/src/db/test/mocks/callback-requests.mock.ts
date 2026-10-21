import type {
  CallbackRequestRow,
  NewCallbackRequestRow,
} from '../../schema.js';

/**
 * Shared fixtures for the callback-request persistence tests (AIS-37).
 *
 * They live here — not inside a `.spec.ts` — because the coding standards
 * require every stub/fixture to be reusable and kept in one place. Shape-wise
 * they mirror the schema: `createdAt` is a real `Date`, because that is what
 * Postgres returns through `postgres.js` (the row type is `$inferSelect`).
 */

/** A syntactically valid v4 UUID, used wherever a real id is needed. */
export const VALID_CALLBACK_REQUEST_ID = '3f0d1c2a-5b47-4a1e-9c6d-0e8b7a6f5d4c';

/** A syntactically valid v4 UUID that is guaranteed to differ from the above. */
export const OTHER_CALLBACK_REQUEST_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/** A stored row exactly as the database would hand it back. */
export function buildCallbackRequestRow(
  overrides: Partial<CallbackRequestRow> = {},
): CallbackRequestRow {
  return {
    id: VALID_CALLBACK_REQUEST_ID,
    name: 'Teszt Elek',
    email: 'teszt@example.com',
    phone: '+36301234567',
    reason: 'Szeretnék visszahívást kérni a weboldalon.',
    status: 'queued',
    createdAt: new Date('2026-10-21T08:00:00.000Z'),
    ...overrides,
  };
}

/**
 * An insert payload with only the caller-owned fields filled in.
 *
 * `id`, `status` and `createdAt` are omitted on purpose: their defaults belong
 * to the schema, and the contract says the database decides them.
 */
export function buildCreateInput(
  overrides: Partial<NewCallbackRequestRow> = {},
): NewCallbackRequestRow {
  return {
    name: 'Teszt Elek',
    email: 'teszt@example.com',
    phone: '+36301234567',
    reason: 'Szeretnék visszahívást kérni a weboldalon.',
    ...overrides,
  };
}
