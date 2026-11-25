/**
 * The four filters of the *Napló* tab (AIS-181 `D10`).
 *
 * Controlled and stateless: every value arrives in `params` (parsed from the URL)
 * and every change leaves through `onFilterChange`, so the tab stays the only
 * writer of the URL and one interaction is one write.
 *
 * Three facts shape the controls:
 *
 * - each select carries an explicit **“Összes”** entry instead of a `placeholder`:
 *   a placeholder is a *disabled* empty option, which would make a chosen filter
 *   impossible to clear from its own control;
 * - the author select only offers uuids that appear on the page — a free-text uuid
 *   field could never be typed, because `useListParams` resets an invalid value to
 *   its default on the first keystroke;
 * - the end picker's `min` is the start picker's day, so an inverted range is not
 *   selectable and the server's `422` cannot be provoked from the UI.
 */

import { Button, DatePicker, FormField, Select } from '@callback/ui';
import { toDateInputValue } from '../../../lib/date.js';
import {
  hasActiveAuditFilters,
  toAuditActorFilterOptions,
  toAuditActorFilterValue,
  toAuditFromBound,
  toAuditOperationFilterOptions,
  toAuditOperationFilterValue,
  toAuditTableFilterOptions,
  toAuditTableFilterValue,
  toAuditToBound,
} from '../customer-audit-log.logic.js';
import {
  CUSTOMER_AUDIT_FILTER_ACTOR_LABEL,
  CUSTOMER_AUDIT_FILTER_CLEAR_LABEL,
  CUSTOMER_AUDIT_FILTER_FROM_LABEL,
  CUSTOMER_AUDIT_FILTER_IDS,
  CUSTOMER_AUDIT_FILTER_OPERATION_LABEL,
  CUSTOMER_AUDIT_FILTER_TABLE_LABEL,
  CUSTOMER_AUDIT_FILTER_TO_LABEL,
} from '../customers.const.js';
import type { CustomerAuditFiltersProps } from '../customers.interface.js';

/**
 * @param props - see {@link CustomerAuditFiltersProps}.
 */
export function CustomerAuditFilters({
  params,
  actorOptions,
  onFilterChange,
  onReset,
}: CustomerAuditFiltersProps) {
  const fromDay = toDateInputValue(params.from ?? null);
  const toDay = toDateInputValue(params.to ?? null);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <FormField
        id={CUSTOMER_AUDIT_FILTER_IDS.tableName}
        label={CUSTOMER_AUDIT_FILTER_TABLE_LABEL}
      >
        {(field) => (
          <Select
            id={field.id}
            value={params.tableName ?? ''}
            options={toAuditTableFilterOptions()}
            onChange={(event) => {
              onFilterChange({
                tableName: toAuditTableFilterValue(event.target.value),
              });
            }}
          />
        )}
      </FormField>

      <FormField
        id={CUSTOMER_AUDIT_FILTER_IDS.operation}
        label={CUSTOMER_AUDIT_FILTER_OPERATION_LABEL}
      >
        {(field) => (
          <Select
            id={field.id}
            value={params.operation ?? ''}
            options={toAuditOperationFilterOptions()}
            onChange={(event) => {
              onFilterChange({
                operation: toAuditOperationFilterValue(event.target.value),
              });
            }}
          />
        )}
      </FormField>

      <FormField
        id={CUSTOMER_AUDIT_FILTER_IDS.actorId}
        label={CUSTOMER_AUDIT_FILTER_ACTOR_LABEL}
      >
        {(field) => (
          <Select
            id={field.id}
            value={params.actorId ?? ''}
            options={toAuditActorFilterOptions(actorOptions)}
            onChange={(event) => {
              onFilterChange({
                actorId: toAuditActorFilterValue(event.target.value),
              });
            }}
          />
        )}
      </FormField>

      <FormField
        id={CUSTOMER_AUDIT_FILTER_IDS.from}
        label={CUSTOMER_AUDIT_FILTER_FROM_LABEL}
      >
        {(field) => (
          <DatePicker
            id={field.id}
            value={fromDay}
            max={toDay === '' ? undefined : toDay}
            onChange={(value) => {
              onFilterChange({ from: toAuditFromBound(value) });
            }}
          />
        )}
      </FormField>

      <FormField
        id={CUSTOMER_AUDIT_FILTER_IDS.to}
        label={CUSTOMER_AUDIT_FILTER_TO_LABEL}
      >
        {(field) => (
          <DatePicker
            id={field.id}
            value={toDay}
            min={fromDay === '' ? undefined : fromDay}
            onChange={(value) => {
              onFilterChange({ to: toAuditToBound(value) });
            }}
          />
        )}
      </FormField>

      <div className="flex items-end sm:col-span-2 lg:col-span-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!hasActiveAuditFilters(params)}
        >
          {CUSTOMER_AUDIT_FILTER_CLEAR_LABEL}
        </Button>
      </div>
    </div>
  );
}
