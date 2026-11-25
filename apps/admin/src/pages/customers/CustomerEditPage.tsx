/**
 * `/customers/:id/edit` — the edit page of one customer (AIS-21).
 *
 * Composition only. The page **reads** through the same hook the detail page
 * uses, decides the surface through the same **pure** rule
 * (`toCustomerDetailState`), and hands the record to the form. It owns two
 * things the form must not own: the routing (cancel and success both leave for
 * the customer's own page) and the re-read that a stale write needs.
 *
 * The form is mounted **keyed by `updatedAt`**, exactly like the `api-keys` edit
 * overlay (`AIS-172`): `useAppForm` seeds `defaultValues` on mount only, so a
 * refreshed row can reach the inputs through a remount and by no other route —
 * which is also what makes the stale-write notice disappear by itself once the
 * new version arrives.
 *
 * No state of its own: the id is the URL, the record is the query cache, the
 * values are the form's, and “is the stale notice showing” belongs to the form
 * that produced it.
 */

import { EmptyState, PageShell, Skeleton } from '@callback/ui';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageErrorState } from '../../components/error/PageErrorState.js';
import { toCustomerDetailViewModel } from '../../entities/customer/customer.mapper.js';
import { useCustomerDetail } from '../../features/customers/use-customer-detail.js';
import {
  CUSTOMER_DETAIL_NOT_FOUND_MESSAGE,
  CUSTOMER_DETAIL_NOT_FOUND_TITLE,
  CUSTOMER_DETAIL_PARAM,
  CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION,
  CUSTOMER_DETAIL_UNAVAILABLE_TITLE,
  CUSTOMER_EDIT_BACK_LABEL,
  CUSTOMER_EDIT_ERROR_TITLE,
  CUSTOMER_EDIT_LOADING_MESSAGE,
  CUSTOMER_EDIT_PAGE_TITLE,
} from './customers.const.js';
import {
  toCustomerDetailRoute,
  toCustomerDetailState,
} from './customers.logic.js';
import { CustomerEditForm } from './ui/CustomerEditForm.js';

/**
 * @returns the edit page of one customer.
 */
export function CustomerEditPage() {
  const params = useParams();
  const id = params[CUSTOMER_DETAIL_PARAM];
  const navigate = useNavigate();

  const detail = useCustomerDetail(id);
  const data = detail.data;

  const state = toCustomerDetailState({
    isLoading: detail.isLoading,
    error: detail.error,
    errorSurface: detail.errorSurface,
    hasData: data !== null,
  });

  /**
   * Leaves the form for the customer's own page.
   *
   * `navigate`, never `history.back()`: a deep link into `/edit` must not take
   * the operator out of the app, and the detail page is the only sensible
   * destination of both the cancel and the success path.
   */
  const leaveEdit = (): void => {
    if (id !== undefined) {
      navigate(toCustomerDetailRoute(id));
    }
  };

  const detailRoute = id === undefined ? undefined : toCustomerDetailRoute(id);

  let content: ReactNode;

  if (state === 'loading') {
    content = (
      <div className="space-y-6">
        <p role="status" className="sr-only">
          {CUSTOMER_EDIT_LOADING_MESSAGE}
        </p>
        <Skeleton lines={8} />
      </div>
    );
  } else if (state === 'not-found') {
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_NOT_FOUND_TITLE}
        description={CUSTOMER_DETAIL_NOT_FOUND_MESSAGE}
      />
    );
  } else if (state === 'unavailable') {
    // The layout's banner already explains this tier (AIS-96), so the page must
    // not repeat its sentence — only say that the editor cannot be filled in now.
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_UNAVAILABLE_TITLE}
        description={CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION}
      />
    );
  } else if (state === 'error') {
    content = (
      <PageErrorState
        title={CUSTOMER_EDIT_ERROR_TITLE}
        message={detail.errorMessage ?? CUSTOMER_EDIT_ERROR_TITLE}
        onRetry={detail.refetch}
        isRetrying={detail.isFetching}
      />
    );
  } else if (data === null) {
    // Unreachable in practice (`success` means a payload arrived), but an empty
    // body is never allowed.
    content = (
      <EmptyState
        title={CUSTOMER_DETAIL_NOT_FOUND_TITLE}
        description={CUSTOMER_DETAIL_NOT_FOUND_MESSAGE}
      />
    );
  } else {
    content = (
      <CustomerEditForm
        key={data.updatedAt}
        customer={data}
        onLeave={leaveEdit}
        onReload={detail.refetch}
      />
    );
  }

  return (
    <PageShell
      title={CUSTOMER_EDIT_PAGE_TITLE}
      subtitle={
        data === null ? undefined : toCustomerDetailViewModel(data).displayName
      }
      back={
        detailRoute === undefined ? undefined : (
          <Link
            to={detailRoute}
            className="text-sm text-text-secondary underline-offset-4 hover:underline"
          >
            {CUSTOMER_EDIT_BACK_LABEL}
          </Link>
        )
      }
    >
      {content}
    </PageShell>
  );
}
