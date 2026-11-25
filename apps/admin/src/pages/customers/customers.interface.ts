/**
 * Types of the `customers` page (AIS-19).
 *
 * Page-local by design: nothing outside `pages/customers/` needs these shapes.
 */

import type { ReactNode } from 'react';
import type {
  CustomerDetail,
  CustomerListQuery,
  CustomerStatus,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import type {
  CustomerDetailViewModel,
  CustomerRowViewModel,
  CustomerRowViewModels,
} from '../../entities/customer/customer.interface.js';
import type { CustomerUpdateFieldName } from '../../features/customers/customers.interface.js';
import type { ErrorSurface } from '../../lib/error-surface.interface.js';
import type { CustomerWizardStep } from './customers-wizard.interface.js';

/** One entry of the wizard's step strip. */
export interface CustomerWizardStepDefinition {
  /** The step the entry jumps to (also the `?step=` value). */
  readonly step: CustomerWizardStep;
  /** Visible title of the step. */
  readonly title: string;
}

/**
 * Props of the filter row.
 *
 * The component is controlled and stateless apart from the search field's own
 * text: every filter value arrives in `params` (parsed from the URL) and every
 * change leaves through a callback, so the page remains the only writer of the
 * URL.
 */
export interface CustomersFiltersProps {
  /** The parsed query — the current state of every control. */
  readonly params: CustomerListQuery;
  /** Reports the debounced search text. */
  readonly onSearchChange: (query: string) => void;
  /** Reports one filter change; the page performs one URL write. */
  readonly onFilterChange: (patch: Partial<CustomerListQuery>) => void;
  /** Reports the reset request (all filters back to their defaults, one write). */
  readonly onReset: () => void;
}

/**
 * Props of the list part of the page.
 *
 * The failure is **not** one of them: an unavailable list is the page's data
 * being unavailable, so `PageErrorState` is rendered by the page. The pager is a
 * slot for the same reason — the page decides whether one exists at all
 * (`meta === null` while loading).
 */
export interface CustomersTableProps {
  /** Already mapped rows; the table never sees a nullable wire field. */
  readonly customers: CustomerRowViewModels;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** The sort the URL currently asks for, shown on the column headers. */
  readonly sort: DataTableSort;
  /** Reports a sort request; the page turns it into a URL patch. */
  readonly onSortChange: (sort: DataTableSort) => void;
  /** The empty-state node, chosen by the page (filtered vs unfiltered copy). */
  readonly empty: ReactNode;
  /** Reports an archive request for one row; the page opens the confirmation. */
  readonly onArchive: (customer: CustomerRowViewModel) => void;
  /** The pager, rendered under the table when the page has a `meta`. */
  readonly pagination?: ReactNode;
}

/** Props of the archive confirmation window. */
export interface ArchiveCustomerDialogProps {
  /** Whether the window is open — local `useState` in the page (AIS-173). */
  readonly open: boolean;
  /** Called on every dismissal (cancel, `Esc`, outside click). */
  readonly onOpenChange: (open: boolean) => void;
  /** Name of the customer the confirmation is about. */
  readonly customerName: string;
  /** `true` while the archive write is in flight. */
  readonly isPending: boolean;
  /** Confirmed archive request. */
  readonly onConfirm: () => void;
}

/** Props of the wizard shell's step strip. */
export interface CustomerWizardStepperProps {
  /** The active step, read from `?step=`. */
  readonly activeStep: CustomerWizardStep;
  /** Reports a step request (a navigation). */
  readonly onStepChange: (step: CustomerWizardStep) => void;
}

/** Props of the wizard shell's chrome. */
export interface CustomerWizardShellProps {
  /** The step the URL currently shows. */
  readonly activeStep: CustomerWizardStep;
  /** Reports a step request; the page turns it into one URL write. */
  readonly onStepChange: (step: CustomerWizardStep) => void;
}

/**
 * One tab of the customer detail page (AIS-20).
 *
 * Declared as a literal union here, not derived from the constant, so the two
 * files are not circular: the strip in `customers.const.ts` is checked against
 * this union with `satisfies`, and {@link CustomerTabDefinition} plus the page's
 * total `Record<CustomerTab, …>` of panels fail the build when one side grows
 * without the other.
 */
export type CustomerTab =
  | 'overview'
  | 'data'
  | 'contacts'
  | 'users'
  | 'activity'
  | 'audit';

/** One entry of the detail page's tab strip: the `?tab=` value and its label. */
export interface CustomerTabDefinition {
  /** The value written into the URL. */
  readonly value: CustomerTab;
  /** The visible label of the tab. */
  readonly label: string;
}

/** Props of the tab strip. */
export interface CustomerTabsProps {
  /** The tab the URL currently shows. */
  readonly tab: CustomerTab;
  /** Reports a tab request; the page turns it into one URL write. */
  readonly onTabChange: (tab: CustomerTab) => void;
}

/**
 * Props of one tab body.
 *
 * A tab receives the **view model**, never the wire payload: that is what makes
 * the four later tabs (AIS-179 / AIS-181) unable to reintroduce a formatting
 * decision the mapper already made.
 */
export interface CustomerTabPanelProps {
  /** The already formatted detail page model. */
  readonly customer: CustomerDetailViewModel;
}

/**
 * The states of the detail read (AIS-20).
 *
 * Five and not four, because a failure the page does **not** own must not be
 * rendered as a page error: `unavailable` is the banner tier's failure (offline,
 * `401`, `503`), which the layout's `AppErrorBanner` already explains in its own
 * words, so the page must not repeat the same sentence (AIS-96).
 */
export type CustomerDetailState =
  | 'loading'
  | 'not-found'
  | 'error'
  | 'unavailable'
  | 'success';

/**
 * What {@link toCustomerDetailState} reads.
 *
 * Only the pieces of the read the decision needs, so the rule is testable with
 * plain values and a component never passes a whole query object around.
 */
export interface CustomerDetailStateInput {
  /** `useApiDetail`'s `isLoading`. */
  readonly isLoading: boolean;
  /** `useApiDetail`'s `error` — the raw thrown value, deliberately `unknown`. */
  readonly error: unknown;
  /** `useApiDetail`'s `errorSurface`, or `null` when there is no failure. */
  readonly errorSurface: ErrorSurface | null;
  /** `true` when a payload has arrived. */
  readonly hasData: boolean;
}

/**
 * The values the edit form holds (AIS-21).
 *
 * A **total** record over the feature's field union, with `string` in every slot:
 * the form shows a text control for every editable field, so `null` and “absent”
 * are modelled as the empty string here and converted back to the wire shape by
 * `toUpdateCustomerPayload()`. A field added to the union without a value in the
 * page's defaults is a compile error, which is what keeps the two in step.
 */
export type CustomerEditValues = Readonly<
  Record<CustomerUpdateFieldName, string>
>;

/**
 * Props of the edit form.
 *
 * The form owns no read and no routing: the page fetched the record and passes
 * it down, and the two callbacks are the only ways out — `onCancel` for the
 * *Mégse* action and `onReload` for the stale-write notice's reload button.
 */
export interface CustomerEditFormProps {
  /** The record the inputs are seeded from (the mapper's raw source). */
  readonly customer: CustomerDetail;
  /**
   * Leaves the form for the customer's own page.
   *
   * Used by both the *Mégse* button and a successful save: the form itself never
   * navigates (ticket key decision 4), and the detail page is the destination of
   * both paths.
   */
  readonly onLeave: () => void;
  /** Re-reads the record after a `409 STALE_WRITE`. */
  readonly onReload: () => void;
}

/**
 * Props of the detail header's write actions (AIS-21).
 *
 * Only the four values the actions need: the edit link and the archive dialog
 * want the name, the status dialog wants the current status and the version it
 * must send back as the concurrency token.
 */
export interface CustomerDetailHeaderActionsProps {
  /** The customer's uuid — the edit link's segment and the mutations' target. */
  readonly customerId: string;
  /** `shortName ?? legalName`, already resolved by the mapper. */
  readonly displayName: string;
  /** The status the dialog preselects. */
  readonly status: CustomerStatus;
  /** The version the status change must send as `updatedAt`. */
  readonly updatedAt: string;
  /** Reports a successful archive; the page leaves the now-dead detail page. */
  readonly onArchived: () => void;
}

/**
 * Values of the status-change form.
 *
 * One field, and it is a real form: `useAppForm` gives it the same validation,
 * failure mapping, first-error focus and single announcement the edit form has,
 * so the header action cannot invent a second submit path.
 */
export interface CustomerStatusFormValues {
  /** The status the operator chose. */
  readonly status: CustomerStatus;
}

/**
 * Props of the status-change window.
 *
 * A **non-navigable modal** (AIS-173 exception): nothing links to it and nothing
 * reloads into it, so its open flag is local `useState` in the header actions —
 * exactly like the archive confirmation AIS-19 already ships. The owner mounts
 * the component **only while the window is open**, which is what re-seeds the
 * form's values on every opening (react-hook-form reads `defaultValues` on mount).
 */
export interface CustomerStatusDialogProps {
  /** The customer the new status belongs to. */
  readonly customerId: string;
  /** The status the select starts on. */
  readonly currentStatus: CustomerStatus;
  /** The version the `PATCH /:id/status` body must carry. */
  readonly updatedAt: string;
  /** Called on every dismissal (cancel, `Esc`, outside click, success). */
  readonly onClose: () => void;
}
