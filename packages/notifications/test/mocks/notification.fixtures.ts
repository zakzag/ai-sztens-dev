import type {
  NotificationDetailField,
  NotificationEntry,
  NotificationStoreOptions,
} from '../../src/core/notification.interface.js';

/** Fixed epoch milliseconds every test starts from, so ids and windows are reproducible. */
export const FIXED_NOW = 1_700_000_000_000;

/**
 * Controllable clock handed to the store, so the dedupe window can be crossed
 * without real timers.
 */
export interface TestClock {
  readonly now: () => number;
  /** Moves the clock forward. */
  advance(milliseconds: number): void;
  /** Overwrites the clock. */
  set(milliseconds: number): void;
}

/**
 * Builds a fake clock.
 *
 * @param start - initial epoch milliseconds; defaults to {@link FIXED_NOW}.
 * @returns the clock and the two mutators used by the tests.
 */
export function createTestClock(start: number = FIXED_NOW): TestClock {
  let current = start;

  return {
    now: () => current,
    advance: (milliseconds: number) => {
      current += milliseconds;
    },
    set: (milliseconds: number) => {
      current = milliseconds;
    },
  };
}

/**
 * Builds a structured detail field fixture.
 *
 * @param overrides - fields to replace.
 * @returns a valid field; `mono` stays absent unless the caller sets it.
 */
export function createTestDetailField(
  overrides: Partial<NotificationDetailField> = {},
): NotificationDetailField {
  return {
    label: 'requestId',
    value: 'req-1',
    ...overrides,
  };
}

/**
 * Builds a detail record fixture for the `details` record entry point.
 *
 * Keys are ordered deliberately so a test can prove that the insertion order is
 * preserved instead of being sorted.
 *
 * @param overrides - values to replace; new keys are appended.
 * @returns a redactable record with mixed value types.
 */
export function createTestDetailsRecord(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    status: 422,
    code: 'VALIDATION',
    requestId: 'req-1',
    ...overrides,
  };
}

/**
 * Builds a notification entry fixture.
 *
 * @param overrides - fields to replace.
 * @returns a valid entry, newest-first lists assume the caller controls `createdAt`.
 */
export function createTestEntry(overrides: Partial<NotificationEntry> = {}): NotificationEntry {
  return {
    id: 'ntf-test-1',
    level: 'info',
    message: 'Test message',
    source: 'manual',
    createdAt: FIXED_NOW,
    read: false,
    toast: true,
    repeatCount: 1,
    ...overrides,
  };
}

/**
 * Builds store options with a controllable clock.
 *
 * @param overrides - options to replace; `now` is always the fake clock.
 * @returns the options for `createNotificationStore`.
 */
export function createTestStoreOptions(
  overrides: Omit<NotificationStoreOptions, 'now'> = {},
): NotificationStoreOptions {
  return { now: createTestClock().now, ...overrides };
}
