import { describe, expect, it } from 'vitest';
import {
  LOG_DRAWER_WIDTH_CSS_VAR,
  LOG_DRAWER_WIDTH_DEFAULT,
  LOG_DRAWER_WIDTH_MAX,
  LOG_DRAWER_WIDTH_MIN,
  LOG_DRAWER_WIDTH_STEP,
  LOG_DRAWER_WIDTH_STEP_LARGE,
  LOG_ENTRY_DETAILS_TOGGLE_LABEL_CLOSE,
  LOG_ENTRY_DETAILS_TOGGLE_LABEL_OPEN,
  LOG_ENTRY_REQUEST_ID_FIELD_LABEL,
} from '../src/components/log-drawer/log-drawer.const.js';
import {
  clampDrawerWidth,
  findRequestIdField,
  toEntryJson,
  toEntryToggleLabel,
  toWidthFromDrag,
  toWidthFromKey,
  toWidthStyle,
} from '../src/components/log-drawer/log-drawer.logic.js';
import type {
  LogDrawerSizeRange,
  LogEntryItem,
} from '../src/components/log-drawer/log-drawer.interface.js';
import {
  LOG_ENTRY_REQUEST_ID_VALUE,
  buildLogDetailField,
  buildLogDetails,
  buildLogEntry,
} from './mocks/log-entries.mock.js';

/** The production range, so the tests assert the shipped numbers. */
const RANGE: LogDrawerSizeRange = {
  min: LOG_DRAWER_WIDTH_MIN,
  max: LOG_DRAWER_WIDTH_MAX,
  initial: LOG_DRAWER_WIDTH_DEFAULT,
};

describe('clampDrawerWidth', () => {
  it('keeps a value inside the range untouched', () => {
    expect(clampDrawerWidth(500, RANGE)).toBe(500);
  });

  it('raises a value below the minimum to the minimum', () => {
    expect(clampDrawerWidth(120, RANGE)).toBe(LOG_DRAWER_WIDTH_MIN);
    expect(clampDrawerWidth(-40, RANGE)).toBe(LOG_DRAWER_WIDTH_MIN);
  });

  it('lowers a value above the maximum to the maximum', () => {
    expect(clampDrawerWidth(1_600, RANGE)).toBe(LOG_DRAWER_WIDTH_MAX);
  });

  it('keeps the exact bounds', () => {
    expect(clampDrawerWidth(LOG_DRAWER_WIDTH_MIN, RANGE)).toBe(
      LOG_DRAWER_WIDTH_MIN,
    );
    expect(clampDrawerWidth(LOG_DRAWER_WIDTH_MAX, RANGE)).toBe(
      LOG_DRAWER_WIDTH_MAX,
    );
  });

  it('falls back to the initial width for NaN', () => {
    expect(clampDrawerWidth(Number.NaN, RANGE)).toBe(LOG_DRAWER_WIDTH_DEFAULT);
  });

  it('falls back to the initial width for both infinities', () => {
    expect(clampDrawerWidth(Number.POSITIVE_INFINITY, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
    expect(clampDrawerWidth(Number.NEGATIVE_INFINITY, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
  });

  it('clamps the fallback itself into a range that excludes it', () => {
    const shifted: LogDrawerSizeRange = { min: 500, max: 900, initial: 400 };

    expect(clampDrawerWidth(Number.NaN, shifted)).toBe(500);
  });
});

describe('toWidthFromDrag', () => {
  const start = LOG_DRAWER_WIDTH_DEFAULT;

  it('keeps the start width while the pointer does not travel', () => {
    expect(toWidthFromDrag(600, 600, start, RANGE)).toBe(start);
  });

  it('widens the panel when the pointer travels left', () => {
    expect(toWidthFromDrag(600, 550, start, RANGE)).toBe(start + 50);
  });

  it('narrows the panel when the pointer travels right', () => {
    expect(toWidthFromDrag(600, 650, start, RANGE)).toBe(start - 50);
  });

  it('ignores the absolute pointer position', () => {
    expect(toWidthFromDrag(120, 100, start, RANGE)).toBe(
      toWidthFromDrag(1_020, 1_000, start, RANGE),
    );
  });

  it('clamps a long drag to the maximum', () => {
    expect(toWidthFromDrag(600, -400, start, RANGE)).toBe(LOG_DRAWER_WIDTH_MAX);
  });

  it('clamps a long drag to the minimum', () => {
    expect(toWidthFromDrag(600, 4_000, start, RANGE)).toBe(
      LOG_DRAWER_WIDTH_MIN,
    );
  });

  it('falls back to the initial width for a non-finite coordinate', () => {
    expect(toWidthFromDrag(600, Number.NaN, start, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
    expect(toWidthFromDrag(Number.POSITIVE_INFINITY, 600, start, RANGE)).toBe(
      LOG_DRAWER_WIDTH_DEFAULT,
    );
  });
});

describe('toWidthFromKey', () => {
  const current = LOG_DRAWER_WIDTH_DEFAULT;

  it('widens the panel with ArrowLeft by one step', () => {
    expect(toWidthFromKey('ArrowLeft', current, RANGE)).toBe(
      current + LOG_DRAWER_WIDTH_STEP,
    );
  });

  it('narrows the panel with ArrowRight by one step', () => {
    expect(toWidthFromKey('ArrowRight', current, RANGE)).toBe(
      current - LOG_DRAWER_WIDTH_STEP,
    );
  });

  it('uses the large step while Shift is held', () => {
    expect(toWidthFromKey('ArrowLeft', current, RANGE, true)).toBe(
      current + LOG_DRAWER_WIDTH_STEP_LARGE,
    );
    expect(toWidthFromKey('ArrowRight', current, RANGE, true)).toBe(
      current - LOG_DRAWER_WIDTH_STEP_LARGE,
    );
  });

  it('jumps to the bounds with Home and End', () => {
    expect(toWidthFromKey('Home', current, RANGE)).toBe(LOG_DRAWER_WIDTH_MIN);
    expect(toWidthFromKey('End', current, RANGE)).toBe(LOG_DRAWER_WIDTH_MAX);
  });

  it('leaves the width unchanged for an unrelated key', () => {
    expect(toWidthFromKey('a', current, RANGE)).toBe(current);
    expect(toWidthFromKey('Enter', current, RANGE)).toBe(current);
  });

  it('never overshoots a bound', () => {
    expect(toWidthFromKey('ArrowLeft', LOG_DRAWER_WIDTH_MAX, RANGE, true)).toBe(
      LOG_DRAWER_WIDTH_MAX,
    );
    expect(
      toWidthFromKey('ArrowRight', LOG_DRAWER_WIDTH_MIN, RANGE, true),
    ).toBe(LOG_DRAWER_WIDTH_MIN);
  });
});

describe('toWidthStyle', () => {
  it('publishes the width as the shared custom property', () => {
    expect(toWidthStyle(480)).toEqual({ [LOG_DRAWER_WIDTH_CSS_VAR]: '480px' });
  });

  it('produces exactly one property', () => {
    expect(Object.keys(toWidthStyle(LOG_DRAWER_WIDTH_DEFAULT))).toHaveLength(1);
  });
});

/** Parsed form of the JSON payload, so assertions need no per-test cast. */
type ParsedEntryJson = Record<string, unknown>;

/**
 * Parses the payload the "copy JSON" control would put on the clipboard.
 *
 * @param entry - entry to serialise and parse.
 * @returns the parsed object, keyed by field name.
 */
function parseEntryJson(entry: LogEntryItem): ParsedEntryJson {
  return JSON.parse(toEntryJson(entry)) as ParsedEntryJson;
}

describe('toEntryToggleLabel', () => {
  it('names the open action while the row is collapsed', () => {
    expect(toEntryToggleLabel(false, 0)).toBe(
      LOG_ENTRY_DETAILS_TOGGLE_LABEL_OPEN,
    );
  });

  it('names the close action while the row is expanded', () => {
    expect(toEntryToggleLabel(true, 0)).toBe(
      LOG_ENTRY_DETAILS_TOGGLE_LABEL_CLOSE,
    );
  });

  it('appends the number of facts when the entry has any', () => {
    expect(toEntryToggleLabel(false, 3)).toBe(
      `${LOG_ENTRY_DETAILS_TOGGLE_LABEL_OPEN} (3 részlet)`,
    );
    expect(toEntryToggleLabel(true, 1)).toBe(
      `${LOG_ENTRY_DETAILS_TOGGLE_LABEL_CLOSE} (1 részlet)`,
    );
  });

  it('ignores a negative count', () => {
    expect(toEntryToggleLabel(false, -2)).toBe(
      LOG_ENTRY_DETAILS_TOGGLE_LABEL_OPEN,
    );
  });
});

describe('toEntryJson', () => {
  it('is deterministic across calls', () => {
    const entry = buildLogEntry({
      detail: 'POST /api/v1/keys → 500',
      details: buildLogDetails(),
    });

    expect(toEntryJson(entry)).toBe(toEntryJson(entry));
  });

  it('carries the identity, severity, message, timestamp and facts', () => {
    const entry = buildLogEntry({
      level: 'warning',
      message: 'Lassú kérés',
      details: buildLogDetails(),
    });

    const parsed = parseEntryJson(entry);

    expect(parsed['id']).toBe(entry.id);
    expect(parsed['level']).toBe('warning');
    expect(parsed['message']).toBe('Lassú kérés');
    expect(parsed['createdAt']).toBe(entry.createdAt);
    expect(parsed['details']).toEqual(buildLogDetails());
  });

  it('stays valid JSON for an entry with neither detail nor details', () => {
    const parsed = parseEntryJson(buildLogEntry());

    expect(parsed).not.toHaveProperty('detail');
    expect(parsed).not.toHaveProperty('details');
  });

  it('keeps the field order stable', () => {
    const parsed = parseEntryJson(buildLogEntry({ detail: 'context' }));

    expect(Object.keys(parsed)).toEqual([
      'id',
      'level',
      'message',
      'detail',
      'createdAt',
    ]);
  });
});

describe('findRequestIdField', () => {
  it('finds the request id field of the entry', () => {
    expect(findRequestIdField(buildLogDetails())?.value).toBe(
      LOG_ENTRY_REQUEST_ID_VALUE,
    );
  });

  it('matches the label regardless of case and surrounding spaces', () => {
    const field = buildLogDetailField({
      label: ` ${LOG_ENTRY_REQUEST_ID_FIELD_LABEL.toUpperCase()} `,
      value: 'req-9',
    });

    expect(findRequestIdField([field])).toBe(field);
  });

  it('returns null when the entry has no details at all', () => {
    expect(findRequestIdField(undefined)).toBeNull();
    expect(findRequestIdField([])).toBeNull();
  });

  it('returns null when no field carries the request id label', () => {
    expect(
      findRequestIdField([buildLogDetailField({ label: 'url' })]),
    ).toBeNull();
  });

  it('prefers the first matching field', () => {
    const first = buildLogDetailField({ value: 'first' });
    const second = buildLogDetailField({ value: 'second' });

    expect(findRequestIdField([first, second])).toBe(first);
  });
});
