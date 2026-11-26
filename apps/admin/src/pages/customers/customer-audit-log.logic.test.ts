/**
 * Tests of the audit tab's pure rules (AIS-181).
 *
 * Three groups: the option lists (always with a clearing entry, so a filter can be
 * undone from its own control), the SQL-value narrowers (a hand-edited URL must
 * degrade to “no filter”, never to an invalid query), and the calendar-day →
 * instant conversion, which has to turn the **inclusive** upper bound into the
 * start of the following day.
 */

import {
  AUDIT_LOG_TABLE_VALUES,
  AUDIT_OPERATION_VALUES,
  VALID_AUDIT_LOG,
} from '@callback/shared';
import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_AUDIT_OPERATION_LABELS,
  CUSTOMER_AUDIT_TABLE_LABELS,
} from '../../entities/customer/customer.const.js';
import { toCustomerAuditLogViewModel } from '../../entities/customer/customer-audit-log.mapper.js';
import {
  CUSTOMER_AUDIT_FILTER_ALL_LABEL,
  CUSTOMER_AUDIT_REQUEST_ID_LABEL,
} from './customers.const.js';
import {
  hasActiveAuditFilters,
  toAuditActorFilterOptions,
  toAuditActorFilterValue,
  toAuditFromBound,
  toAuditLogEntryItem,
  toAuditOperationFilterOptions,
  toAuditOperationFilterValue,
  toAuditTableFilterOptions,
  toAuditTableFilterValue,
  toAuditToBound,
} from './customer-audit-log.logic.js';

/** One hour, in milliseconds — the unit the range assertions are phrased in. */
const HOUR_MS = 60 * 60 * 1000;

describe('toAuditTableFilterOptions', () => {
  it('starts with the clearing entry and lists every table', () => {
    const options = toAuditTableFilterOptions();

    expect(options[0]).toEqual({ value: '', label: CUSTOMER_AUDIT_FILTER_ALL_LABEL });
    expect(options).toHaveLength(AUDIT_LOG_TABLE_VALUES.length + 1);
    expect(options[1]).toEqual({
      value: AUDIT_LOG_TABLE_VALUES[0],
      label: CUSTOMER_AUDIT_TABLE_LABELS[AUDIT_LOG_TABLE_VALUES[0]],
    });
  });
});

describe('toAuditOperationFilterOptions', () => {
  it('starts with the clearing entry and lists every operation', () => {
    const options = toAuditOperationFilterOptions();

    expect(options[0]?.value).toBe('');
    expect(options.map((option) => option.value)).toEqual([
      '',
      ...AUDIT_OPERATION_VALUES,
    ]);
    expect(options[1]?.label).toBe(
      CUSTOMER_AUDIT_OPERATION_LABELS[AUDIT_OPERATION_VALUES[0]],
    );
  });
});

describe('toAuditActorFilterOptions', () => {
  it('prepends the clearing entry to the actor options', () => {
    const options = toAuditActorFilterOptions([
      { id: 'actor-1', name: 'Kálmán Rák' },
    ]);

    expect(options).toEqual([
      { value: '', label: CUSTOMER_AUDIT_FILTER_ALL_LABEL },
      { value: 'actor-1', label: 'Kálmán Rák' },
    ]);
  });

  it('offers only the clearing entry when the page has no actor', () => {
    expect(toAuditActorFilterOptions([])).toHaveLength(1);
  });
});

describe('toAuditTableFilterValue', () => {
  it('keeps a known table', () => {
    expect(toAuditTableFilterValue('customers')).toBe('customers');
  });

  it('maps the empty value and an unknown table to “no filter”', () => {
    expect(toAuditTableFilterValue('')).toBeUndefined();
    expect(toAuditTableFilterValue('legacy_table')).toBeUndefined();
  });
});

describe('toAuditOperationFilterValue', () => {
  it('keeps a known operation and drops everything else', () => {
    expect(toAuditOperationFilterValue('soft_delete')).toBe('soft_delete');
    expect(toAuditOperationFilterValue('')).toBeUndefined();
    expect(toAuditOperationFilterValue('archive')).toBeUndefined();
  });
});

describe('toAuditActorFilterValue', () => {
  it('keeps an id and maps the empty value to “no filter”', () => {
    expect(toAuditActorFilterValue('actor-1')).toBe('actor-1');
    expect(toAuditActorFilterValue('')).toBeUndefined();
  });
});

describe('toAuditFromBound', () => {
  it('answers the local start of the chosen day', () => {
    const bound = toAuditFromBound('2026-11-23');

    expect(bound).toBeDefined();
    expect(new Date(bound as string).getHours()).toBe(0);
    expect(new Date(bound as string).getMinutes()).toBe(0);
  });

  it('answers undefined for an empty or impossible day', () => {
    expect(toAuditFromBound('')).toBeUndefined();
    expect(toAuditFromBound('2026-02-31')).toBeUndefined();
  });
});

describe('toAuditToBound', () => {
  it('answers the start of the following day, so the bound is inclusive', () => {
    const from = toAuditFromBound('2026-11-23');
    const to = toAuditToBound('2026-11-23');

    expect(to).toBeDefined();

    const span = new Date(to as string).getTime() - new Date(from as string).getTime();

    // 23 or 25 hours around a DST switch, 24 otherwise — never zero, never two days.
    expect(span).toBeGreaterThanOrEqual(23 * HOUR_MS);
    expect(span).toBeLessThanOrEqual(25 * HOUR_MS);
    expect(new Date(to as string).getHours()).toBe(0);
  });

  it('answers undefined for an empty or impossible day', () => {
    expect(toAuditToBound('')).toBeUndefined();
    expect(toAuditToBound('2026-13-01')).toBeUndefined();
  });
});

describe('hasActiveAuditFilters', () => {
  it('is false for the defaulted query', () => {
    expect(
      hasActiveAuditFilters({ page: 1, limit: 20, order: 'desc' }),
    ).toBe(false);
  });

  it.each([
    ['tableName', { page: 1, limit: 20, order: 'desc', tableName: 'customers' }],
    ['operation', { page: 1, limit: 20, order: 'desc', operation: 'insert' }],
    ['actorId', { page: 1, limit: 20, order: 'desc', actorId: 'actor-1' }],
    [
      'from',
      { page: 1, limit: 20, order: 'desc', from: '2026-11-01T00:00:00.000Z' },
    ],
    ['to', { page: 1, limit: 20, order: 'desc', to: '2026-11-02T00:00:00.000Z' }],
  ] as const)('is true when %s is set', (_name, params) => {
    expect(hasActiveAuditFilters(params)).toBe(true);
  });
});

describe('toAuditLogEntryItem', () => {
  it('projects the row onto the log primitive contract', () => {
    const row = toCustomerAuditLogViewModel(VALID_AUDIT_LOG);
    const entry = toAuditLogEntryItem(row);

    expect(entry.id).toBe(row.id);
    expect(entry.level).toBe(row.level);
    expect(entry.message).toBe(VALID_AUDIT_LOG.actorName);
    expect(entry.createdAt).toBe(row.occurredAtMs);
    expect(entry.detail).toContain(row.tableLabel);
    expect(entry.detail).toContain(row.actorTypeText);
  });

  it('turns every diff pair into one mono detail field', () => {
    const row = toCustomerAuditLogViewModel(VALID_AUDIT_LOG);
    const entry = toAuditLogEntryItem(row);

    // The insert fixture has four changed columns plus the request id.
    expect(entry.details).toHaveLength(row.diffFields.length + 1);
    expect(entry.details?.[0]?.mono).toBe(true);
    expect(entry.details?.[0]?.value).toContain('→');
    expect(entry.details?.[entry.details.length - 1]?.label).toBe(
      CUSTOMER_AUDIT_REQUEST_ID_LABEL,
    );
  });

  it('omits the request-id field when the row has no correlation id', () => {
    const row = toCustomerAuditLogViewModel({
      ...VALID_AUDIT_LOG,
      requestId: null,
    });
    const entry = toAuditLogEntryItem(row);

    expect(entry.details).toHaveLength(row.diffFields.length);
  });
});
