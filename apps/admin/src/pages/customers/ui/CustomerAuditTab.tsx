/**
 * The *Napló* tab of the customer detail page (AIS-181).
 *
 * **Read-only by construction**: this module imports one read hook, one mapper and
 * two presentational parts — there is no mutation, no delete button and no edit
 * affordance anywhere in its graph. The ledger is append-only on the server
 * (`AuditWriter` only, `UPDATE`/`DELETE` refused by triggers), so the UI has nothing
 * to offer and the DoD's “no mutating action” is a property of the imports rather
 * than of a `disabled` flag.
 *
 * The four filters (`tableName`, `operation`, `actorId`, `from`, `to`) are all URL
 * state through `useListParams`, which means they survive a reload and a copied
 * link, and the hook's write keeps `?tab=` intact. The author choices are derived
 * from the rows of the current page — there is no directory endpoint — and the
 * range bounds convert calendar days into the instants the contract expects.
 */

import { EmptyState, Pagination } from '@callback/ui';
import { useMemo, type ReactNode } from 'react';
import { auditLogListQuerySchema } from '@callback/shared';
import { PageErrorState } from '../../../components/error/PageErrorState.js';
import {
  toAuditActorOptions,
  toCustomerAuditLogViewModels,
} from '../../../entities/customer/customer-audit-log.mapper.js';
import { useCustomerAuditLogs } from '../../../features/customers/use-customer-audit-logs.js';
import { CUSTOMERS_LIMIT_OPTIONS } from '../../../features/customers/customers.const.js';
import { useListParams } from '../../../features/api/use-list-params.js';
import { hasActiveAuditFilters } from '../customer-audit-log.logic.js';
import {
  CUSTOMER_AUDIT_EMPTY_DESCRIPTION,
  CUSTOMER_AUDIT_EMPTY_FILTERED_DESCRIPTION,
  CUSTOMER_AUDIT_EMPTY_FILTERED_TITLE,
  CUSTOMER_AUDIT_EMPTY_TITLE,
  CUSTOMER_AUDIT_ERROR_TITLE,
  CUSTOMER_AUDIT_LOADING_MESSAGE,
  CUSTOMER_AUDIT_READ_ONLY_NOTICE,
  CUSTOMER_AUDIT_TITLE,
  CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION,
  CUSTOMER_DETAIL_UNAVAILABLE_TITLE,
} from '../customers.const.js';
import type { CustomerTabPanelProps } from '../customers.interface.js';
import { CustomerAuditFilters } from './CustomerAuditFilters.js';
import { CustomerAuditLogList } from './CustomerAuditLogList.js';

/**
 * @param props - see {@link CustomerTabPanelProps}; the id is the only value the
 * ledger read needs.
 */
export function CustomerAuditTab({ customer }: CustomerTabPanelProps) {
  const { params, setParam, setParams, resetParams } = useListParams(
    auditLogListQuerySchema,
  );
  const ledger = useCustomerAuditLogs(customer.id, params);

  const rows = useMemo(
    () => toCustomerAuditLogViewModels(ledger.auditLogs),
    [ledger.auditLogs],
  );

  /*
    The author choices come from the page's own rows (no directory endpoint), so
    they are memoised on the rows instead of being rebuilt on every render.
  */
  const actors = useMemo(
    () => toAuditActorOptions(ledger.auditLogs),
    [ledger.auditLogs],
  );

  const isFiltered = hasActiveAuditFilters(params);

  let content: ReactNode;

  if (ledger.errorSurface === 'page') {
    content = (
      <PageErrorState
        title={CUSTOMER_AUDIT_ERROR_TITLE}
        message={ledger.errorMessage ?? CUSTOMER_AUDIT_ERROR_TITLE}
        onRetry={ledger.refetch}
        isRetrying={ledger.isFetching}
      />
    );
  } else if (ledger.errorSurface === 'banner') {
    // The layout's `AppErrorBanner` already says what went wrong (AIS-96).
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_UNAVAILABLE_TITLE}
        description={CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION}
      />
    );
  } else {
    content = (
      <div className="space-y-4">
        <p role="status" className="sr-only">
          {CUSTOMER_AUDIT_LOADING_MESSAGE}
        </p>

        <CustomerAuditLogList
          rows={rows}
          isLoading={ledger.isLoading}
          empty={
            isFiltered ? (
              <EmptyState
                title={CUSTOMER_AUDIT_EMPTY_FILTERED_TITLE}
                description={CUSTOMER_AUDIT_EMPTY_FILTERED_DESCRIPTION}
              />
            ) : (
              <EmptyState
                title={CUSTOMER_AUDIT_EMPTY_TITLE}
                description={CUSTOMER_AUDIT_EMPTY_DESCRIPTION}
              />
            )
          }
        />

        {ledger.meta === null || rows.length === 0 ? null : (
          <Pagination
            meta={ledger.meta.pagination}
            limitOptions={CUSTOMERS_LIMIT_OPTIONS}
            onPageChange={(page) => {
              setParam('page', page);
            }}
            onLimitChange={(limit) => {
              setParams({ limit });
            }}
          />
        )}
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-label={CUSTOMER_AUDIT_TITLE}>
      <CustomerAuditFilters
        params={params}
        actorOptions={actors}
        onFilterChange={(patch) => {
          setParams(patch);
        }}
        onReset={resetParams}
      />

      <p className="text-xs text-text-muted">{CUSTOMER_AUDIT_READ_ONLY_NOTICE}</p>

      {content}
    </section>
  );
}
