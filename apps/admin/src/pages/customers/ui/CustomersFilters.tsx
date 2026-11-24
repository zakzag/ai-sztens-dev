/**
 * The filter row of the customers list (AIS-19).
 *
 * This is the page that closes the two documented gaps of the standard list
 * (AIS-174): a **server-side search field** and the contract's three filters.
 *
 * State rules: every filter value arrives in `params` — parsed from the URL by
 * the page — and every change leaves through a callback, so the page is the only
 * URL writer. The search field's **own text** is local `useState` (bucket 4),
 * because a keystroke is not a navigation: the settled term is written to the
 * URL after {@link CUSTOMERS_SEARCH_DEBOUNCE_MS}, so one search produces one
 * history entry instead of one per character.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, Card, FormField, Input, Select } from '@callback/ui';
import type { CustomersFiltersProps } from '../customers.interface.js';
import {
  CUSTOMER_SOURCE_FILTER_OPTIONS,
  CUSTOMER_STATUS_FILTER_OPTIONS,
  CUSTOMER_TYPE_FILTER_OPTIONS,
  CUSTOMERS_FILTER_ALL_LABEL,
  CUSTOMERS_FILTER_FIELD_IDS,
  CUSTOMERS_FILTER_LABELS,
  CUSTOMERS_FILTER_RESET_LABEL,
  CUSTOMERS_SEARCH_DEBOUNCE_MS,
  CUSTOMERS_SEARCH_HINT,
} from '../customers.const.js';
import {
  toCustomerSource,
  toCustomerStatus,
  toCustomerType,
} from '../customers.logic.js';

/**
 * @param props - see {@link CustomersFiltersProps}.
 */
export function CustomersFilters({
  params,
  onSearchChange,
  onFilterChange,
  onReset,
}: CustomersFiltersProps) {
  const currentQuery = params.q ?? '';
  const [query, setQuery] = useState(currentQuery);

  /*
    The debounced write needs the latest callback but must not restart its timer
    every time the parent re-renders (the URL setters are recreated per render).
    Keeping the callback in a ref does exactly that: the effect depends on the
    typed text and on the URL's settled value, nothing else.
  */
  const onSearchChangeRef = useRef(onSearchChange);

  useEffect(() => {
    onSearchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  useEffect(() => {
    // Already settled (or the URL has just caught up): nothing to write, so a
    // mount never produces a redundant history entry.
    if (query === currentQuery) {
      return;
    }

    const timer = setTimeout(() => {
      onSearchChangeRef.current(query);
    }, CUSTOMERS_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, currentQuery]);

  return (
    <Card>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            id={CUSTOMERS_FILTER_FIELD_IDS.search}
            label={CUSTOMERS_FILTER_LABELS.search}
            hint={CUSTOMERS_SEARCH_HINT}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />

          <FormField
            id={CUSTOMERS_FILTER_FIELD_IDS.type}
            label={CUSTOMERS_FILTER_LABELS.type}
          >
            {(field) => (
              <Select
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={CUSTOMER_TYPE_FILTER_OPTIONS}
                placeholder={CUSTOMERS_FILTER_ALL_LABEL}
                value={params.type ?? ''}
                onChange={(event) => {
                  onFilterChange({ type: toCustomerType(event.target.value) });
                }}
              />
            )}
          </FormField>

          <FormField
            id={CUSTOMERS_FILTER_FIELD_IDS.status}
            label={CUSTOMERS_FILTER_LABELS.status}
          >
            {(field) => (
              <Select
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={CUSTOMER_STATUS_FILTER_OPTIONS}
                placeholder={CUSTOMERS_FILTER_ALL_LABEL}
                value={params.status ?? ''}
                onChange={(event) => {
                  onFilterChange({ status: toCustomerStatus(event.target.value) });
                }}
              />
            )}
          </FormField>

          <FormField
            id={CUSTOMERS_FILTER_FIELD_IDS.source}
            label={CUSTOMERS_FILTER_LABELS.source}
          >
            {(field) => (
              <Select
                id={field.id}
                invalid={field.invalid}
                describedBy={field.describedBy}
                options={CUSTOMER_SOURCE_FILTER_OPTIONS}
                placeholder={CUSTOMERS_FILTER_ALL_LABEL}
                value={params.source ?? ''}
                onChange={(event) => {
                  onFilterChange({ source: toCustomerSource(event.target.value) });
                }}
              />
            )}
          </FormField>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            {CUSTOMERS_FILTER_RESET_LABEL}
          </Button>
        </div>
      </div>
    </Card>
  );
}
