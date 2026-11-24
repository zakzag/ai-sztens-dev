/**
 * Types of the `customers` page (AIS-19).
 *
 * Page-local by design: nothing outside `pages/customers/` needs these shapes.
 */

import type { ReactNode } from 'react';
import type { CustomerListQuery } from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import type {
  CustomerRowViewModel,
  CustomerRowViewModels,
} from '../../entities/customer/customer.interface.js';
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
