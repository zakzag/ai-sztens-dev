/**
 * `/customers` — the customer list (AIS-19).
 *
 * Composition only: the page reads the server state through the feature hook,
 * maps the wire rows to view models once per response, and hands both to the
 * presentational parts. It owns no server data and no filter state — the whole
 * query (page, limit, sort, order, search, the three filters) lives in the
 * **URL** through `useListParams`, so a filtered view is linkable and the back
 * button works.
 *
 * The page owns exactly one piece of local state: which customer the archive
 * confirmation is about. A confirmation has no address of its own (AIS-173
 * exception), so it is `useState` here rather than a route or a store.
 *
 * The detail and edit targets are sibling routes owned by AIS-20 / AIS-21; this
 * page only builds their URLs (`toCustomerDetailRoute`, `toCustomerEditRoute`).
 *
 * @returns the page content.
 */

import { useMemo, useState } from 'react';
import { customerListQuerySchema } from '@callback/shared';
import type { CustomerListQuery } from '@callback/shared';
import {
  EmptyState,
  PageShell,
  Pagination,
  buttonVariants,
  PlusIcon,
} from '@callback/ui';
import type { DataTableSort } from '@callback/ui';
import { Link, useNavigate } from 'react-router-dom';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import { toCustomerRowViewModels } from '../../entities/customer/customer.mapper.js';
import type { CustomerRowViewModel } from '../../entities/customer/customer.interface.js';
import {
  CUSTOMERS_LIMIT_OPTIONS,
} from '../../features/customers/customers.const.js';
import {
  hasActiveFilters,
  toSortParams,
  toTableSort,
} from '../../features/customers/customers.logic.js';
import { useArchiveCustomerMutation } from '../../features/customers/use-archive-customer.js';
import { useCustomersList } from '../../features/customers/use-customers-list.js';
import { useListParams } from '../../features/api/use-list-params.js';
import {
  CUSTOMERS_CREATE_LABEL,
  CUSTOMERS_CREATE_ROUTE_PATH,
  CUSTOMERS_EMPTY_TITLE,
  CUSTOMERS_ERROR_TITLE,
  CUSTOMERS_FILTER_DEFAULTS_PATCH,
  CUSTOMERS_PAGE_SUBTITLE,
  CUSTOMERS_PAGE_TITLE,
} from './customers.const.js';
import { toEmptyStateDescription } from './customers.logic.js';
import { ArchiveCustomerDialog } from './ui/ArchiveCustomerDialog.js';
import { CustomersFilters } from './ui/CustomersFilters.js';
import { CustomersTable } from './ui/CustomersTable.js';

/**
 * @returns the list page with its filters, table and pager.
 */
export function CustomersPage() {
  const { params, setParam, setParams } = useListParams(
    customerListQuerySchema,
  );
  const {
    customers,
    meta,
    isLoading,
    isFetching,
    errorMessage,
    errorSurface,
    refetch,
  } = useCustomersList(params);
  const { archiveCustomer, isPending } = useArchiveCustomerMutation();
  const navigate = useNavigate();

  const [archiveTarget, setArchiveTarget] = useState<CustomerRowViewModel | null>(
    null,
  );

  const viewModels = useMemo(
    () => toCustomerRowViewModels(customers),
    [customers],
  );
  const pageErrorMessage = errorSurface === 'page' ? errorMessage : null;

  const handleSearchChange = (query: string): void => {
    // An empty term is “no search”, not an empty `q=`: the URL builder drops
    // `undefined`, so clearing the field returns the address to its canonical
    // form.
    setParam('q', query.length > 0 ? query : undefined);
  };

  const handleFilterChange = (patch: Partial<CustomerListQuery>): void => {
    // One interaction, one URL write: `setParams` merges the patch, resets the
    // page and never builds the URL from a stale render.
    setParams(patch);
  };

  const handleReset = (): void => {
    setParams(CUSTOMERS_FILTER_DEFAULTS_PATCH);
  };

  const handleSortChange = (next: DataTableSort): void => {
    setParams(toSortParams(next));
  };

  const handleConfirmArchive = (): void => {
    if (archiveTarget === null) {
      return;
    }

    void archiveCustomer(archiveTarget.id)
      .then(() => {
        setArchiveTarget(null);
      })
      .catch(() => {
        /*
          Not swallowed: the mutation maps the failure (`errorMessage`) and the
          notification capture (AIS-84) renders it once. The window stays open on
          purpose, so the user can retry or cancel instead of guessing whether
          the archive happened.
        */
      });
  };

  return (
    <PageShell
      title={CUSTOMERS_PAGE_TITLE}
      subtitle={CUSTOMERS_PAGE_SUBTITLE}
      actions={
        /*
          A link, not a button: creating a customer is a navigation to
          `/customers/new`, so open-in-new-tab and copy-link keep working.
        */
        <Link to={CUSTOMERS_CREATE_ROUTE_PATH} className={buttonVariants()}>
          <PlusIcon />
          {CUSTOMERS_CREATE_LABEL}
        </Link>
      }
    >
      <div className="space-y-6">
        <CustomersFilters
          params={params}
          onSearchChange={handleSearchChange}
          onFilterChange={handleFilterChange}
          onReset={handleReset}
        />

        {pageErrorMessage !== null ? (
          <PageErrorState
            title={CUSTOMERS_ERROR_TITLE}
            message={pageErrorMessage}
            onRetry={refetch}
            isRetrying={isFetching}
          />
        ) : (
          <CustomersTable
            customers={viewModels}
            isLoading={isLoading}
            sort={toTableSort(params)}
            onSortChange={handleSortChange}
            onArchive={setArchiveTarget}
            empty={
              <EmptyState
                title={CUSTOMERS_EMPTY_TITLE}
                description={toEmptyStateDescription(hasActiveFilters(params))}
                /*
                  Documented exception (AIS-17 `D8`): on this page an empty list
                  is the normal first visit of an operator, so the empty state
                  carries the same create CTA as the header. Every other page
                  keeps the “no action in the empty state” rule.
                */
                action={{
                  label: CUSTOMERS_CREATE_LABEL,
                  onAction: () => {
                    navigate(CUSTOMERS_CREATE_ROUTE_PATH);
                  },
                }}
              />
            }
            pagination={
              meta === null ? undefined : (
                <Pagination
                  meta={meta.pagination}
                  limitOptions={CUSTOMERS_LIMIT_OPTIONS}
                  onPageChange={(page) => {
                    setParam('page', page);
                  }}
                  onLimitChange={(limit) => {
                    setParam('limit', limit);
                  }}
                />
              )
            }
          />
        )}
      </div>

      <ArchiveCustomerDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
        customerName={archiveTarget?.displayName ?? ''}
        isPending={isPending}
        onConfirm={handleConfirmArchive}
      />
    </PageShell>
  );
}
