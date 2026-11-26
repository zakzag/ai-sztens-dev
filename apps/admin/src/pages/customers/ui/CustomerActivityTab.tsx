/**
 * The *Tevékenység* tab of the customer detail page (AIS-181).
 *
 * A **paged, URL-driven feed**: the query (`page`, `limit`, `order`) is parsed by
 * `useListParams` from the shared `activityListQuerySchema`, so the state survives a
 * reload and a copied link, and the hook's write keeps `?tab=` intact (`D4`). The
 * tab owns no server data — the rows come from `useCustomerActivities` and stay in
 * the query cache.
 *
 * Two interactions are **local `useState`**, and both are deliberate:
 * `editingId` (the inline editor has no address) and `deleteTarget` (a confirmation
 * has none either — the AIS-173 exception). A page-local store would be a defect
 * here: neither value is linkable, neither comes from the server, and nothing else
 * on the page reads them.
 *
 * The note form renders in **every** state, including empty and failure: a customer
 * without history must still be able to receive the first entry.
 */

import {
  EmptyState,
  Pagination,
  Skeleton,
} from '@callback/ui';
import { useMemo, useState, type ReactNode } from 'react';
import { activityListQuerySchema } from '@callback/shared';
import { PageErrorState } from '../../../components/error/PageErrorState.js';
import { CUSTOMERS_LIMIT_OPTIONS } from '../../../features/customers/customers.const.js';
import { useCustomerActivities } from '../../../features/customers/use-customer-activities.js';
import { useListParams } from '../../../features/api/use-list-params.js';
import { toCustomerActivityViewModels } from '../../../entities/customer/customer-activity.mapper.js';
import type { CustomerActivityViewModel } from '../../../entities/customer/customer.interface.js';
import {
  CUSTOMER_ACTIVITY_EMPTY_DESCRIPTION,
  CUSTOMER_ACTIVITY_EMPTY_TITLE,
  CUSTOMER_ACTIVITY_ERROR_TITLE,
  CUSTOMER_ACTIVITY_LOADING_MESSAGE,
  CUSTOMER_ACTIVITY_TITLE,
  CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION,
  CUSTOMER_DETAIL_UNAVAILABLE_TITLE,
} from '../customers.const.js';
import type { CustomerTabPanelProps } from '../customers.interface.js';
import { CustomerActivityDeleteDialog } from './CustomerActivityDeleteDialog.js';
import { CustomerActivityFeedItem } from './CustomerActivityFeedItem.js';
import { CustomerActivityForm } from './CustomerActivityForm.js';

/**
 * @param props - see {@link CustomerTabPanelProps}; only the id is used, because
 * the feed is its own read.
 */
export function CustomerActivityTab({ customer }: CustomerTabPanelProps) {
  const { params, setParam } = useListParams(activityListQuerySchema);
  const feed = useCustomerActivities(customer.id, params);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<CustomerActivityViewModel | null>(null);

  const rows = useMemo(
    () => toCustomerActivityViewModels(feed.activities),
    [feed.activities],
  );

  let content: ReactNode;

  if (feed.isLoading) {
    content = (
      <div className="space-y-2">
        <p role="status" className="sr-only">
          {CUSTOMER_ACTIVITY_LOADING_MESSAGE}
        </p>
        <Skeleton lines={6} />
      </div>
    );
  } else if (feed.errorSurface === 'page') {
    /*
      The tab's own failure, not the page's: the other tabs may be perfectly
      readable, so this `PageErrorState` is rendered inside the tab region
      (screen contract §3.3).
    */
    content = (
      <PageErrorState
        title={CUSTOMER_ACTIVITY_ERROR_TITLE}
        message={feed.errorMessage ?? CUSTOMER_ACTIVITY_ERROR_TITLE}
        onRetry={feed.refetch}
        isRetrying={feed.isFetching}
      />
    );
  } else if (feed.errorSurface === 'banner') {
    // The layout's `AppErrorBanner` already says what went wrong (AIS-96).
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_UNAVAILABLE_TITLE}
        description={CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION}
      />
    );
  } else if (rows.length === 0) {
    content = (
      <EmptyState
        title={CUSTOMER_ACTIVITY_EMPTY_TITLE}
        description={CUSTOMER_ACTIVITY_EMPTY_DESCRIPTION}
      />
    );
  } else {
    content = (
      <div className="space-y-4">
        <ol className="space-y-3">
          {rows.map((activity) => (
            <CustomerActivityFeedItem
              key={activity.id}
              customerId={customer.id}
              activity={activity}
              isEditing={editingId === activity.id}
              onStartEdit={setEditingId}
              onCancelEdit={() => {
                setEditingId(null);
              }}
              onSaved={() => {
                setEditingId(null);
              }}
              onStaleWrite={() => {
                setEditingId(null);
                feed.refetch();
              }}
              onDelete={setDeleteTarget}
            />
          ))}
        </ol>

        {feed.meta === null ? null : (
          <Pagination
            meta={feed.meta.pagination}
            limitOptions={CUSTOMERS_LIMIT_OPTIONS}
            onPageChange={(page) => {
              setParam('page', page);
            }}
            onLimitChange={(limit) => {
              setParam('limit', limit);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-label={CUSTOMER_ACTIVITY_TITLE}>
      <CustomerActivityForm customerId={customer.id} />
      {content}

      {deleteTarget === null ? null : (
        <CustomerActivityDeleteDialog
          customerId={customer.id}
          activity={deleteTarget}
          onClose={() => {
            setDeleteTarget(null);
          }}
        />
      )}
    </section>
  );
}
