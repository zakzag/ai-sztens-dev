import type { NotificationEntry } from '../../../src/core/notification.interface.js';

/** Fixed epoch milliseconds of the newest entry, so ids and timestamps are reproducible. */
export const REACT_FIXED_NOW = 1_700_000_000_000;

/**
 * Builds one notification entry.
 *
 * @param overrides - fields to replace.
 * @returns a valid entry; `createdAt` defaults to {@link REACT_FIXED_NOW}.
 */
export function createEntry(overrides: Partial<NotificationEntry> = {}): NotificationEntry {
  return {
    id: 'ntf-react-1',
    level: 'info',
    message: 'Teszt üzenet',
    source: 'manual',
    createdAt: REACT_FIXED_NOW,
    read: false,
    toast: true,
    repeatCount: 1,
    ...overrides,
  };
}

/**
 * Builds a **newest-first** entry list of a given length.
 *
 * Index `0` is the newest, matching the store contract, and each entry has a
 * distinct id and message so a paging assertion can name the row it expects.
 *
 * @param count - how many entries to build.
 * @param level - level of every entry; defaults to `info`.
 * @returns the entries, newest first.
 */
export function createEntryList(
  count: number,
  level: NotificationEntry['level'] = 'info',
): readonly NotificationEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createEntry({
      id: `ntf-react-${index}`,
      level,
      message: `Üzenet ${index}`,
      createdAt: REACT_FIXED_NOW - index,
    }),
  );
}
