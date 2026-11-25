/**
 * Pure rules of the *Napló* tab's filter row (AIS-181).
 *
 * Three concerns live here, all of them testable without React:
 *
 * 1. **options** — the two closed vocabularies of the contract plus the derived
 *    author list, always with an explicit “Összes” entry so a filter can be
 *    cleared from its own control;
 * 2. **calendar day → ISO instant** — `auditLogListQuerySchema` bounds `occurredAt`
 *    with instants while the pickers yield days, and `to` is an **inclusive** upper
 *    bound, so it has to become the *start of the following day* (`D11`);
 * 3. **“is anything filtered?”** — the empty state's copy differs between “a
 *    customer without history” and “this filter finds nothing”.
 */

import {
  AUDIT_LOG_TABLE_VALUES,
  AUDIT_OPERATION_VALUES,
  dateOnlyToLocalIsoInstant,
  type AuditLogListQuery,
} from '@callback/shared';
import type { LogDetailField, LogEntryItem, SelectOption } from '@callback/ui';
import { toAuditDiffText } from '../../entities/customer/customer-audit-log.mapper.js';
import {
  CUSTOMER_AUDIT_OPERATION_LABELS,
  CUSTOMER_AUDIT_TABLE_LABELS,
} from '../../entities/customer/customer.const.js';
import type {
  AuditLogActorOption,
  CustomerAuditLogViewModel,
} from '../../entities/customer/customer.interface.js';
import {
  CUSTOMER_AUDIT_FILTER_ALL_LABEL,
  CUSTOMER_AUDIT_META_SEPARATOR,
  CUSTOMER_AUDIT_REQUEST_ID_LABEL,
} from './customers.const.js';

/** The option that stands for “no filter”; its value is the empty string. */
const ALL_OPTION: SelectOption = Object.freeze({
  value: '',
  label: CUSTOMER_AUDIT_FILTER_ALL_LABEL,
});

/**
 * Narrows one select value onto the ledger's `tableName` filter.
 *
 * The option list is built from the contract's own tuple, so the only reachable
 * values are legal ones; the guard exists so a hand-edited URL cannot smuggle an
 * unknown table into a typed query (it becomes “no filter” instead).
 *
 * @param value - the raw select value (`''` means “all tables”).
 * @returns the table name, or `undefined` for “no filter”.
 */
export function toAuditTableFilterValue(
  value: string,
): AuditLogListQuery['tableName'] {
  const isKnown = (AUDIT_LOG_TABLE_VALUES as readonly string[]).includes(value);

  return isKnown ? (value as AuditLogListQuery['tableName']) : undefined;
}

/**
 * Narrows one select value onto the ledger's `operation` filter.
 *
 * @param value - the raw select value (`''` means “every operation”).
 * @returns the operation, or `undefined` for “no filter”.
 */
export function toAuditOperationFilterValue(
  value: string,
): AuditLogListQuery['operation'] {
  const isKnown = (AUDIT_OPERATION_VALUES as readonly string[]).includes(value);

  return isKnown ? (value as AuditLogListQuery['operation']) : undefined;
}

/**
 * @param value - the raw select value of the author filter.
 * @returns the actor uuid, or `undefined` for “every author”.
 */
export function toAuditActorFilterValue(
  value: string,
): AuditLogListQuery['actorId'] {
  return value === '' ? undefined : value;
}

/**
 * Options of the table filter, with the clearing entry first.
 *
 * @returns one option per `AUDIT_LOG_TABLE_VALUES` entry, labelled from the entity.
 */
export function toAuditTableFilterOptions(): readonly SelectOption[] {
  return [
    ALL_OPTION,
    ...AUDIT_LOG_TABLE_VALUES.map((value) => ({
      value,
      label: CUSTOMER_AUDIT_TABLE_LABELS[value],
    })),
  ];
}

/**
 * Options of the operation filter, with the clearing entry first.
 *
 * @returns one option per `AUDIT_OPERATION_VALUES` entry.
 */
export function toAuditOperationFilterOptions(): readonly SelectOption[] {
  return [
    ALL_OPTION,
    ...AUDIT_OPERATION_VALUES.map((value) => ({
      value,
      label: CUSTOMER_AUDIT_OPERATION_LABELS[value],
    })),
  ];
}

/**
 * Options of the author filter.
 *
 * The value of an option is always a **uuid** the query schema accepts, because
 * `useListParams` silently resets an invalid value — a free-text uuid field could
 * therefore never be typed. `system` actors carry no id and are not selectable.
 *
 * @param actors - the distinct authors of the current page.
 * @returns the clearing entry followed by one option per author.
 */
export function toAuditActorFilterOptions(
  actors: readonly AuditLogActorOption[],
): readonly SelectOption[] {
  return [
    { value: '', label: CUSTOMER_AUDIT_FILTER_ALL_LABEL },
    ...actors.map((actor) => ({ value: actor.id, label: actor.name })),
  ];
}

/**
 * Turns the **start** picker's calendar day into the request's inclusive lower
 * bound (`AIS-181 D11`).
 *
 * @param day - `YYYY-MM-DD`, or `''` for “no lower bound”.
 * @returns the local start of that day as an ISO instant, or `undefined`.
 */
export function toAuditFromBound(day: string): string | undefined {
  return toDayStartInstant(day);
}

/**
 * Turns the **end** picker's calendar day into the request's inclusive upper bound.
 *
 * The contract's `to` is inclusive, so a day at `00:00` would exclude everything
 * that happened after midnight: the bound becomes the local start of the **next**
 * day. `Date#setDate` is what keeps that correct across a DST switch, where the
 * gap is 23 or 25 hours rather than always 24.
 *
 * @param day - `YYYY-MM-DD`, or `''` for “no upper bound”.
 * @returns the local start of the following day as an ISO instant, or `undefined`.
 */
export function toAuditToBound(day: string): string | undefined {
  return toNextDayStartInstant(day);
}

/**
 * @param day - `YYYY-MM-DD`, or `''`.
 * @returns the local start of that day as an ISO instant, or `undefined`.
 */
function toDayStartInstant(day: string): string | undefined {
  if (day === '') {
    return undefined;
  }

  try {
    return dateOnlyToLocalIsoInstant(day);
  } catch {
    // A `<input type="date">` cannot produce an impossible day, but a hand-edited
    // URL can; dropping the bound is the same “invalid → default” rule the list
    // params follow, and the row simply shows every entry.
    return undefined;
  }
}

/**
 * @param day - `YYYY-MM-DD`, or `''`.
 * @returns the local start of the **following** day, or `undefined`.
 */
function toNextDayStartInstant(day: string): string | undefined {
  const startOfDay = toDayStartInstant(day);

  if (startOfDay === undefined) {
    return undefined;
  }

  const next = new Date(startOfDay);

  if (Number.isNaN(next.getTime())) {
    return undefined;
  }

  next.setDate(next.getDate() + 1);

  return next.toISOString();
}

/**
 * @param params - the parsed ledger query.
 * @returns `true` when at least one of the four filters is set.
 */
export function hasActiveAuditFilters(params: AuditLogListQuery): boolean {
  return (
    params.tableName !== undefined ||
    params.operation !== undefined ||
    params.actorId !== undefined ||
    params.from !== undefined ||
    params.to !== undefined
  );
}

/**
 * Projects one mapped audit row onto the `LogEntryRow` item shape (AIS-181 `D8`).
 *
 * The primitive renders a severity glyph, a badge text, a timestamp, one sentence,
 * an optional one-line detail and an expandable key–value list with pretty JSON and
 * a copy control. The ledger maps onto that vocabulary as:
 *
 * | primitive | ledger |
 * | --- | --- |
 * | `level` | the operation's severity (`CUSTOMER_AUDIT_OPERATION_LEVELS`) |
 * | `levelLabel` | the localised operation name (passed as a **prop**) |
 * | `message` | the actor's name |
 * | `detail` | actor kind · table · record id |
 * | `details` | one before → after pair per changed column, plus `requestId` |
 *
 * `requestId` is a detail field on purpose: the primitive shows its “copy request
 * id” control exactly when such a field exists, which is what makes a support
 * conversation about a change start from the ledger row.
 *
 * @param row - one mapped ledger row.
 * @returns the item the primitive renders.
 */
export function toAuditLogEntryItem(row: CustomerAuditLogViewModel): LogEntryItem {
  const detail = [row.actorTypeText, row.tableLabel, row.recordIdText]
    .filter((part): part is string => part !== null)
    .join(CUSTOMER_AUDIT_META_SEPARATOR);

  const diffFields: readonly LogDetailField[] = row.diffFields.map((field) => ({
    label: field.label,
    value: toAuditDiffText(field),
    mono: true,
  }));

  const details: readonly LogDetailField[] =
    row.requestId === null
      ? diffFields
      : [
          ...diffFields,
          {
            label: CUSTOMER_AUDIT_REQUEST_ID_LABEL,
            value: row.requestId,
            mono: true,
          },
        ];

  return {
    id: row.id,
    level: row.level,
    message: row.actorName,
    detail,
    details,
    createdAt: row.occurredAtMs,
  };
}
