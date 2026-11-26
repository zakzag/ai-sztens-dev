/**
 * `/customers/:id` — the customer detail page (AIS-20).
 *
 * Composition only: the page reads the server state through the feature hook,
 * maps the payload to a view model once per response, decides which of the five
 * surfaces to render through a **pure** rule, and hands both to the
 * presentational parts. It owns no server data and no tab state — the tab lives
 * in the **URL** (`?tab=`), so a deep link and a reload land on the same tab and
 * the back button works.
 *
 * The page owns exactly one half of the scope boundary: the shell, the tab frame
 * and the first two tab bodies. The four tabs that belong to AIS-179 / AIS-181 are
 * already part of the frame — `CUSTOMER_TAB_PANELS` is a total record, so their
 * body is a placeholder today and the page itself never changes again when they
 * land.
 *
 * It also renders an `<Outlet/>`: the contact and invite surfaces of AIS-179 are
 * overlay **children** of this route (screen contract §1), and the outlet has to
 * be here for them to mount.
 */

import { EmptyState, PageShell, Skeleton } from '@callback/ui';
import { useMemo, type ReactNode } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import { CustomerStatusBadge } from '../../entities/customer/components/CustomerStatusBadge.js';
import { toCustomerDetailViewModel } from '../../entities/customer/customer.mapper.js';
import { useTabParam } from '../../features/api/use-tab-param.js';
import { useCustomerDetail } from '../../features/customers/use-customer-detail.js';
import {
  CUSTOMER_DETAIL_BACK_LABEL,
  CUSTOMER_DETAIL_DEFAULT_TAB,
  CUSTOMER_DETAIL_ERROR_TITLE,
  CUSTOMER_DETAIL_LOADING_MESSAGE,
  CUSTOMER_DETAIL_NOT_FOUND_MESSAGE,
  CUSTOMER_DETAIL_NOT_FOUND_TITLE,
  CUSTOMER_DETAIL_PAGE_TITLE,
  CUSTOMER_DETAIL_PARAM,
  CUSTOMER_DETAIL_TAB_PARAM,
  CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION,
  CUSTOMER_DETAIL_UNAVAILABLE_TITLE,
  CUSTOMERS_LIST_ROUTE_PATH,
  CUSTOMER_TAB_LIST_PARAM_NAMES,
  CUSTOMER_TAB_VALUES,
} from './customers.const.js';
import { toCustomerDetailState } from './customers.logic.js';
import type { CustomerTab } from './customers.interface.js';
import { CustomerDetailHeaderActions } from './ui/CustomerDetailHeaderActions.js';
import { CustomerTabs } from './ui/CustomerTabs.js';
import { CUSTOMER_TAB_PANELS } from './ui/customer-tab-panels.js';

/**
 * @returns the detail page of one customer.
 */
export function CustomerDetailPage() {
  const params = useParams();
  const id = params[CUSTOMER_DETAIL_PARAM];
  const navigate = useNavigate();

  const detail = useCustomerDetail(id);

  const { value: tab, setValue: setTab } = useTabParam<CustomerTab>({
    paramName: CUSTOMER_DETAIL_TAB_PARAM,
    allowed: CUSTOMER_TAB_VALUES,
    fallback: CUSTOMER_DETAIL_DEFAULT_TAB,
    /*
      A tab switch invalidates the paged list state of the tab being left (AIS-181):
      the activity feed and the ledger share `page`/`limit`, so keeping the page
      across a switch would open the third page of a different collection. The
      deletion happens in the **same** URL write as the tab change.
    */
    clearParams: CUSTOMER_TAB_LIST_PARAM_NAMES,
  });

  const data = detail.data;
  const viewModel = useMemo(
    () => (data === null ? null : toCustomerDetailViewModel(data)),
    [data],
  );

  const state = toCustomerDetailState({
    isLoading: detail.isLoading,
    error: detail.error,
    errorSurface: detail.errorSurface,
    hasData: data !== null,
  });

  let content: ReactNode;

  if (state === 'loading') {
    content = (
      <div className="space-y-6">
        <p role="status" className="sr-only">
          {CUSTOMER_DETAIL_LOADING_MESSAGE}
        </p>
        <Skeleton lines={6} />
      </div>
    );
  } else if (state === 'not-found') {
    /*
      Its own copy and no action: the page cannot invent a customer, and the only
      useful next step — going back to the list — is the link above the title.
    */
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_NOT_FOUND_TITLE}
        description={CUSTOMER_DETAIL_NOT_FOUND_MESSAGE}
      />
    );
  } else if (state === 'unavailable') {
    /*
      The banner tier's failure: the layout's `AppErrorBanner` already says what
      went wrong, so this region must not repeat that sentence (AIS-96).
    */
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_UNAVAILABLE_TITLE}
        description={CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION}
      />
    );
  } else if (state === 'error') {
    content = (
      <PageErrorState
        title={CUSTOMER_DETAIL_ERROR_TITLE}
        message={detail.errorMessage ?? CUSTOMER_DETAIL_ERROR_TITLE}
        onRetry={detail.refetch}
        isRetrying={detail.isFetching}
      />
    );
  } else if (viewModel === null) {
    /*
      Unreachable in practice — `success` means a payload arrived, so the mapper
      ran — but the type does not say that, and an empty body is never allowed.
    */
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_NOT_FOUND_TITLE}
        description={CUSTOMER_DETAIL_NOT_FOUND_MESSAGE}
      />
    );
  } else {
    // The record is total over the tab union, so this lookup cannot miss and a
    // new tab cannot render an empty body.
    const ActivePanel = CUSTOMER_TAB_PANELS[tab];

    content = (
      <div className="space-y-6">
        <CustomerTabs tab={tab} onTabChange={setTab} />
        <ActivePanel customer={viewModel} />
      </div>
    );
  }

  return (
    <PageShell
      title={viewModel?.displayName ?? CUSTOMER_DETAIL_PAGE_TITLE}
      subtitle={viewModel?.customerNumber}
      back={
        <Link
          to={CUSTOMERS_LIST_ROUTE_PATH}
          className="text-sm text-text-secondary underline-offset-4 hover:underline"
        >
          {CUSTOMER_DETAIL_BACK_LABEL}
        </Link>
      }
      actions={
        viewModel === null || data === null ? undefined : (
          /*
            AIS-21 takes over this group: the badge (AIS-20), then the write
            actions — the edit link and the status/archive menu. A successful
            archive leaves for the list, because the row this page shows no
            longer exists.
          */
          <div className="flex items-center gap-3">
            <CustomerStatusBadge status={viewModel.status} />
            <CustomerDetailHeaderActions
              customerId={data.id}
              displayName={viewModel.displayName}
              status={viewModel.status}
              updatedAt={data.updatedAt}
              onArchived={() => {
                navigate(CUSTOMERS_LIST_ROUTE_PATH);
              }}
            />
          </div>
        )
      }
    >
      {content}
      <Outlet />
    </PageShell>
  );
}
