/**
 * Pure mapping of the customer audit ledger (AIS-181).
 *
 * A ledger row is a machine record: a numeric id, a table name, an operation, an
 * actor and two `jsonb` documents that hold **only the columns that changed**. The
 * *Napló* tab needs a formatted timestamp, a localised operation (which is also the
 * row's severity), a localised table and a list of before → after pairs, so every
 * one of those decisions is made here — once, in a pure function.
 *
 * The diff builder is deliberately display-oriented: it produces the strings the
 * row will show, and it uses exactly those strings to decide whether a column
 * actually changed. Comparing raw values instead would need a deep-equal helper
 * for a case the screen cannot distinguish anyway.
 */

import type { AuditLog, AuditLogTable } from '@callback/shared';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_AUDIT_ACTOR_TYPE_LABELS,
  CUSTOMER_AUDIT_DIFF_SEPARATOR,
  CUSTOMER_AUDIT_FIELD_LABELS,
  CUSTOMER_AUDIT_NO_VALUE_LABEL,
  CUSTOMER_AUDIT_OPERATION_LABELS,
  CUSTOMER_AUDIT_OPERATION_LEVELS,
  CUSTOMER_AUDIT_TABLE_LABELS,
} from './customer.const.js';
import type {
  AuditLogActorOption,
  AuditLogDiffField,
  CustomerAuditLogViewModel,
  CustomerAuditLogViewModels,
} from './customer.interface.js';

/** One side of a comparison: either a key is present, or it is not. */
interface DiffSide {
  readonly has: boolean;
  readonly value: unknown;
}

/**
 * Renders one side of a diff as display text.
 *
 * `null`, `undefined` and a missing key all mean “this side has no value”, which
 * is what an inserted or a deleted row looks like. Objects and arrays are
 * compact JSON, so a `jsonb` column never renders as `[object Object]`.
 *
 * @param value - the raw side of the comparison.
 * @returns the text the row shows.
 */
export function toAuditDiffValueText(value: unknown): string {
  if (value === null || value === undefined) {
    return CUSTOMER_AUDIT_NO_VALUE_LABEL;
  }

  if (typeof value === 'string') {
    return value.length === 0 ? CUSTOMER_AUDIT_NO_VALUE_LABEL : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

/**
 * @param side - one side of a comparison.
 * @returns `false` when the key is absent from the document.
 */
function toDiffSide(side: Record<string, unknown> | null, key: string): DiffSide {
  if (side === null || !(key in side)) {
    return { has: false, value: undefined };
  }

  return { has: true, value: side[key] };
}

/**
 * Builds the before → after pairs of one audited change.
 *
 * Key order: the `after` document first, in its own insertion order, then the keys
 * that only the `before` document has. That is stable across renders (JSON objects
 * keep insertion order) and it puts the surviving columns above a dropped one.
 *
 * A column whose two sides render to the same text is **omitted**: the ledger
 * stores changed keys only, but a `soft_delete` writes `deleted_at` beside the row
 * it hid, and showing an unchanged pair would suggest an edit that never happened.
 *
 * @param beforeData - the `before_data` document, or `null`.
 * @param afterData - the `after_data` document, or `null`.
 * @returns the pairs to render, in the order described above.
 */
export function toAuditLogDiffFields(
  beforeData: Record<string, unknown> | null,
  afterData: Record<string, unknown> | null,
): readonly AuditLogDiffField[] {
  const beforeKeys = beforeData === null ? [] : Object.keys(beforeData);
  const afterKeys = afterData === null ? [] : Object.keys(afterData);
  const orderedKeys = [
    ...afterKeys,
    ...beforeKeys.filter((key) => !afterKeys.includes(key)),
  ];

  const fields: AuditLogDiffField[] = [];

  for (const key of orderedKeys) {
    const before = toDiffSide(beforeData, key);
    const after = toDiffSide(afterData, key);

    if (!before.has && !after.has) {
      continue;
    }

    const beforeText = before.has
      ? toAuditDiffValueText(before.value)
      : CUSTOMER_AUDIT_NO_VALUE_LABEL;
    const afterText = after.has
      ? toAuditDiffValueText(after.value)
      : CUSTOMER_AUDIT_NO_VALUE_LABEL;

    if (before.has && after.has && beforeText === afterText) {
      continue;
    }

    fields.push({
      label: CUSTOMER_AUDIT_FIELD_LABELS[key] ?? key,
      beforeText,
      afterText,
    });
  }

  return fields;
}

/**
 * Joins one diff pair into the single value string `LogEntryRow` renders.
 *
 * @param field - one before → after pair.
 * @returns the row's value text, e.g. `AIS Kft. → AIS Zrt.`.
 */
export function toAuditDiffText(field: AuditLogDiffField): string {
  return `${field.beforeText}${CUSTOMER_AUDIT_DIFF_SEPARATOR}${field.afterText}`;
}

/**
 * Maps one wire row to its view model.
 *
 * @param row - one audit-log row of the page.
 * @returns the row, with labels, severity, formatted time and the diff pairs.
 */
export function toCustomerAuditLogViewModel(
  row: AuditLog,
): CustomerAuditLogViewModel {
  const occurredAt = new Date(row.occurredAt);
  const occurredAtMs = occurredAt.getTime();

  return {
    id: String(row.id),
    occurredAtText: formatDateTime(row.occurredAt),
    // An unparsable instant is a contract violation; `0` keeps the formatter's
    // placeholder visible instead of hiding the row from the list.
    occurredAtMs: Number.isNaN(occurredAtMs) ? 0 : occurredAtMs,
    operation: row.operation,
    operationLabel: CUSTOMER_AUDIT_OPERATION_LABELS[row.operation],
    level: CUSTOMER_AUDIT_OPERATION_LEVELS[row.operation],
    tableName: row.tableName,
    /*
      `audit_logs.table_name` is a plain string on the wire (the allow-list is a
      server-side filter), so the label lookup is guarded: an unknown table renders
      its own name instead of `undefined`.
    */
    tableLabel:
      CUSTOMER_AUDIT_TABLE_LABELS[row.tableName as AuditLogTable] ??
      row.tableName,
    actorName: row.actorName,
    actorId: row.actorId,
    actorTypeText: CUSTOMER_AUDIT_ACTOR_TYPE_LABELS[row.actorType],
    recordIdText: row.recordId,
    diffFields: toAuditLogDiffFields(row.beforeData, row.afterData),
    requestId: row.requestId,
  };
}

/**
 * Maps one page of the ledger, keeping the server's order (newest first).
 *
 * @param rows - the rows of the current page.
 * @returns the view models in the same order.
 */
export function toCustomerAuditLogViewModels(
  rows: readonly AuditLog[],
): CustomerAuditLogViewModels {
  return rows.map(toCustomerAuditLogViewModel);
}

/**
 * The author choices of the ledger's `actorId` filter (AIS-181 `D10`).
 *
 * There is no operator directory endpoint in the contract, so the choices are the
 * distinct actors **of the current page**. Only ids are offered, because the filter
 * is a `uuid` the query schema validates: a free-text field would be reset to its
 * default by `useListParams` on the first keystroke. `system` rows carry no
 * `actorId` and are therefore not selectable.
 *
 * @param rows - the rows of the current page.
 * @returns one option per distinct actor, in first-appearance order.
 */
export function toAuditActorOptions(
  rows: readonly AuditLog[],
): readonly AuditLogActorOption[] {
  const seen = new Map<string, string>();

  for (const row of rows) {
    if (row.actorId !== null && !seen.has(row.actorId)) {
      seen.set(row.actorId, row.actorName);
    }
  }

  return [...seen].map(([id, name]) => ({ id, name }));
}
