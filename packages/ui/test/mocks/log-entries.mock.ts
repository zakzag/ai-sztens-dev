import type { LogEntryItem } from '../../src/components/log-drawer/log-drawer.interface.js';

/** Base timestamp of every fixture, so the injected formatter is assertable. */
export const LOG_ENTRY_BASE_TIMESTAMP = 1_700_000_000_000;

/**
 * Builds one `LogEntryItem` for the log drawer suites.
 *
 * Lives here (and not inside the test files) because the repo rule puts every
 * fixture under `test/mocks`.
 *
 * @param overrides - fields to replace on the default error entry.
 * @returns a complete `LogEntryItem`; the default id is `log-1`.
 */
export function buildLogEntry(
  overrides: Partial<LogEntryItem> = {},
): LogEntryItem {
  return {
    id: 'log-1',
    level: 'error',
    message: 'Bejegyzés 1',
    createdAt: LOG_ENTRY_BASE_TIMESTAMP,
    ...overrides,
  };
}

/**
 * Builds a **newest-first** list of `count` entries, `log-1` being the newest.
 *
 * @param count - how many items the list should contain.
 * @returns the items with distinct ids, messages and timestamps, so both the
 *   order and the per-row formatter call are assertable.
 */
export function buildLogEntries(count: number): readonly LogEntryItem[] {
  return Array.from({ length: count }, (_unused, index) =>
    buildLogEntry({
      id: `log-${index + 1}`,
      message: `Bejegyzés ${index + 1}`,
      createdAt: LOG_ENTRY_BASE_TIMESTAMP + index,
    }),
  );
}

/**
 * Stand-in for the host's timestamp formatter.
 *
 * Deterministic and dependency-free, so a test can assert both the calls and
 * the rendered text without a real date library.
 *
 * @param epochMs - timestamp handed in by the row.
 * @returns a marker string carrying the input.
 */
export function stubFormatTimestamp(epochMs: number): string {
  return `idő:${epochMs}`;
}
