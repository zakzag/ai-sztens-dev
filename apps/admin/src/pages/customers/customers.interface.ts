/**
 * Types of the `customers` page (AIS-19).
 *
 * Page-local by design: nothing outside `pages/customers/` needs these shapes.
 */

import type { ReactNode } from 'react';
import type {
  ActivityType,
  AuditLogListQuery,
  ContactRole,
  CustomerDetail,
  CustomerListQuery,
  CustomerStatus,
  CustomerUserRole,
} from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import type {
  AuditLogActorOption,
  CustomerActivityViewModel,
  CustomerAuditLogViewModels,
  CustomerContactViewModel,
  CustomerDetailViewModel,
  CustomerRowViewModel,
  CustomerRowViewModels,
  CustomerUserViewModel,
  CustomerUserViewModels,
} from '../../entities/customer/customer.interface.js';
import type {
  CustomerCreateFieldName,
  CustomerUpdateFieldName,
} from '../../features/customers/customers.interface.js';
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

/**
 * Props of the wizard shell's step strip (AIS-19; extended by AIS-182).
 *
 * `reachableStep` is the **last** step whose predecessors are all valid
 * (`isStepReachable`), derived from the draft by the page — which is why the
 * store keeps its AIS-19 contract. A step beyond it renders disabled: jumping
 * forward would only show a body whose inputs cannot be saved yet.
 */
export interface CustomerWizardStepperProps {
  /** The active step, read from `?step=`. */
  readonly activeStep: CustomerWizardStep;
  /** The last step the draft already unlocks; the later ones are disabled. */
  readonly reachableStep: CustomerWizardStep;
  /** Reports a step request (a navigation). */
  readonly onStepChange: (step: CustomerWizardStep) => void;
}

/**
 * Props of the wizard's stateful screen (AIS-182).
 *
 * Mounted inside the store provider, so it may read the draft — which is what
 * makes `reachableStep` and the server-error routing possible without widening
 * the store contract.
 */
export interface CustomerWizardScreenProps {
  /** The step the URL currently shows. */
  readonly activeStep: CustomerWizardStep;
  /** Performs one URL write; the screen wraps it to drop a stale failure. */
  readonly onStepChange: (step: CustomerWizardStep) => void;
}

/** Props of the wizard shell's chrome. */
export interface CustomerWizardShellProps {
  /** The step the URL currently shows. */
  readonly activeStep: CustomerWizardStep;
  /** The last step the draft already unlocks. */
  readonly reachableStep: CustomerWizardStep;
  /** Reports a step request; the page turns it into one URL write. */
  readonly onStepChange: (step: CustomerWizardStep) => void;
  /**
   * The active step's body.
   *
   * A slot, not a `switch` inside the shell: which step renders, and which
   * failure belongs to it, is the page's decision (`D8`), while the shell stays
   * the chrome the AIS-19 tests already describe.
   */
  readonly children: ReactNode;
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

/*
  ---------------------------------------------------------------------------
  AIS-179 — the contacts and users tabs and their four child overlays
  ---------------------------------------------------------------------------
*/

/**
 * The statuses an operator may set on a login user.
 *
 * `invited` is deliberately absent: it is a server-written state, and
 * `updateCustomerUserSchema` rejects it (`customerUserManagedStatusSchema`).
 */
export type CustomerUserManagedStatus = 'active' | 'inactive';

/** One role checkbox of the contact form, as the form and its test read it. */
export interface CustomerContactRoleFieldDefinition {
  /** The form field the checkbox registers. */
  readonly field: 'isPrimary' | 'isTechnical' | 'isAlerting';
  /** The contract role the flag stands for, in wire vocabulary. */
  readonly role: ContactRole;
  /** DOM id of the checkbox — also the error target of the role conflict. */
  readonly id: string;
  /** Visible label, taken from the entity's role table. */
  readonly label: string;
}

/**
 * Values of the contact form (create **and** edit).
 *
 * Every free-text input is a `string` (`''` means “not set”, converted back to
 * `null`/absent by the payload builders) and the role set is three booleans, so
 * the form needs no `useFieldArray` (plan decision `D3`).
 */
export interface CustomerContactFormValues {
  readonly name: string;
  readonly position: string;
  readonly email: string;
  readonly phone: string;
  readonly customerUserId: string;
  readonly isPrimary: boolean;
  readonly isTechnical: boolean;
  readonly isAlerting: boolean;
  readonly isActive: boolean;
}

/** Values of the invite form. */
export interface CustomerUserInviteFormValues {
  readonly name: string;
  readonly email: string;
  readonly role: CustomerUserRole;
}

/** Values of the login-user edit form. */
export interface CustomerUserEditFormValues {
  readonly name: string;
  readonly role: CustomerUserRole;
  readonly status: CustomerUserManagedStatus;
}

/**
 * Props of the contact form, shared by the create and the edit overlay.
 *
 * One component for both because the four sections, the validation and the
 * failure mapping are identical; the `contact === null` case is what makes it a
 * creation, and it also decides whether the body carries `updatedAt`.
 */
export interface CustomerContactFormProps {
  /** The customer the contact belongs to (route parameter). */
  readonly customerId: string;
  /** The contact being edited, or `null` when the form creates one. */
  readonly contact: CustomerContactViewModel | null;
  /** The customer's login users — the options of the “belépő” select. */
  readonly customerUsers: CustomerUserViewModels;
  /** Called on dismissal and after a successful save. */
  readonly onClose: () => void;
  /** Re-reads the record after a `409 STALE_WRITE`. */
  readonly onStaleWrite: () => void;
}

/** Props of the invite form (create-only). */
export interface CustomerUserInviteFormProps {
  /** The customer the invitation belongs to (route parameter). */
  readonly customerId: string;
  /** Called on dismissal and after a successful save. */
  readonly onClose: () => void;
}

/** Props of the login-user edit form. */
export interface CustomerUserEditFormProps {
  /** The customer the user belongs to (route parameter). */
  readonly customerId: string;
  /** The row being edited, already formatted by the mapper. */
  readonly user: CustomerUserViewModel;
  /** Called on dismissal and after a successful save. */
  readonly onClose: () => void;
  /** Re-reads the record after a `409 STALE_WRITE`. */
  readonly onStaleWrite: () => void;
}

/** Props of the contact archive confirmation (AIS-179). */
export interface ContactArchiveDialogProps {
  /** The customer the contact belongs to. */
  readonly customerId: string;
  /** The row the confirmation is about. */
  readonly contact: CustomerContactViewModel;
  /** Called on every dismissal and after a successful archive. */
  readonly onClose: () => void;
}

/** Props of the invitation-revoke confirmation (AIS-179). */
export interface CustomerUserRevokeDialogProps {
  /** The customer the invitation belongs to. */
  readonly customerId: string;
  /** The pending invitation the confirmation is about. */
  readonly user: CustomerUserViewModel;
  /** Called on every dismissal and after a successful revoke. */
  readonly onClose: () => void;
}

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

/*
  ---------------------------------------------------------------------------
  AIS-181 — the activity feed and the audit ledger
  ---------------------------------------------------------------------------
*/

/** Values of the note form (create). */
export interface CustomerActivityFormValues {
  /** The kind of the new entry — one of the four writable kinds. */
  readonly type: ActivityType;
  /** The entry's text; required, trimmed, bounded. */
  readonly body: string;
}

/** Values of the inline edit form: the text is the only editable field. */
export interface CustomerActivityEditFormValues {
  /** The entry's text; required, trimmed, bounded. */
  readonly body: string;
}

/** Props of the note form above the feed. */
export interface CustomerActivityFormProps {
  /** The customer the entry belongs to (route parameter). */
  readonly customerId: string;
}

/**
 * Props of one feed entry.
 *
 * `isEditing` and the three callbacks are owned by the tab: the inline editor and
 * the delete confirmation have no address of their own (AIS-173 exception), so
 * their state is local `useState` in the tab and never a route or a store.
 */
export interface CustomerActivityFeedItemProps {
  /** The customer the entry belongs to — the writes' path parameter. */
  readonly customerId: string;
  /** The row, already formatted by the mapper. */
  readonly activity: CustomerActivityViewModel;
  /** `true` while this row shows its inline editor. */
  readonly isEditing: boolean;
  /** Requests the inline editor for this row. */
  readonly onStartEdit: (activityId: string) => void;
  /** Leaves the inline editor without saving. */
  readonly onCancelEdit: () => void;
  /** Reports a saved edit (the tab closes the editor and re-reads the feed). */
  readonly onSaved: () => void;
  /** Reports a `409 STALE_WRITE` (the tab re-reads and closes the editor). */
  readonly onStaleWrite: () => void;
  /** Requests the delete confirmation for this row. */
  readonly onDelete: (activity: CustomerActivityViewModel) => void;
}

/** Props of the inline edit form of one entry. */
export interface CustomerActivityEditFormProps {
  /** The customer the entry belongs to (route parameter). */
  readonly customerId: string;
  /** The row being edited — its `updateToken` is the concurrency token. */
  readonly activity: CustomerActivityViewModel;
  /** Leaves the editor without saving. */
  readonly onCancel: () => void;
  /** Called after a successful save. */
  readonly onSaved: () => void;
  /** Called on `409 STALE_WRITE`, **before** the error is re-thrown. */
  readonly onStaleWrite: () => void;
}

/** Props of the activity delete confirmation (AIS-173 exception). */
export interface CustomerActivityDeleteDialogProps {
  /** The customer the entry belongs to (route parameter). */
  readonly customerId: string;
  /** The entry the confirmation is about. */
  readonly activity: CustomerActivityViewModel;
  /** Called on every dismissal and after a successful delete. */
  readonly onClose: () => void;
}

/** Props of the four filters of the ledger. */
export interface CustomerAuditFiltersProps {
  /** The parsed query — the current state of every control. */
  readonly params: AuditLogListQuery;
  /** The author choices, derived from the rows of the current page. */
  readonly actorOptions: readonly AuditLogActorOption[];
  /** Reports one filter change; the tab performs one URL write. */
  readonly onFilterChange: (patch: Partial<AuditLogListQuery>) => void;
  /** Reports the “clear filters” request (all filters back to their defaults). */
  readonly onReset: () => void;
}

/**
 * Props of the ledger's row list.
 *
 * `rows` are view models: the component maps each one to a `LogEntryRow` item, so
 * neither the label table nor the diff builder is reachable from JSX.
 */
export interface CustomerAuditLogListProps {
  /** Already mapped rows, in server order. */
  readonly rows: CustomerAuditLogViewModels;
  /** `true` while the first response is in flight. */
  readonly isLoading: boolean;
  /** The empty-state node, chosen by the tab (filtered vs unfiltered copy). */
  readonly empty: ReactNode;
}

/*
  ---------------------------------------------------------------------------
  AIS-182 — the create wizard's steps 2–4 and its submit
  ---------------------------------------------------------------------------
*/

/**
 * A failure the server sent back for one wizard step (AIS-182, decision `D8`).
 *
 * The create request is sent from step 4, but a `409` blames the tax number on
 * step 2 and a `422` blames whichever input the envelope names. The page keeps
 * the raw error next to the step it belongs to, navigates there, and the step
 * hands the value to `useAppForm.setServerError` — so the mapping stays the
 * hook's and the store keeps its AIS-19 contract.
 */
export interface CustomerWizardServerError {
  /** The step whose input can fix the failure. */
  readonly step: CustomerWizardStep;
  /** The raw rejection, mapped onto the inputs by `useAppForm` on arrival. */
  readonly error: unknown;
}

/**
 * Every input the wizard owns, in visual order (step 2, then step 3).
 *
 * An **alias** of the feature's union, not a second declaration: the field-path
 * list, the code → path table (`features/customers/customers.const.ts`) and the
 * summary rows must all agree, and two copies of ten literals would drift.
 */
export type CustomerWizardFieldName = CustomerCreateFieldName;

/**
 * Values of the wizard's **name and identifiers** step (step 2).
 *
 * `type` is deliberately absent: it is step 1's, and a step only ever writes the
 * fields it owns (`setDraft` merges the patch).
 */
export interface CustomerNameValues {
  readonly legalName: string;
  readonly shortName: string;
  readonly taxNumber: string;
  readonly euVatNumber: string;
  readonly companyRegistrationNumber: string;
  readonly legalForm: string;
}

/** Values of the wizard's **address** step (step 3). */
export interface CustomerAddressValues {
  readonly registeredAddressZip: string;
  readonly registeredAddressCity: string;
  readonly registeredAddressLine: string;
  readonly registeredAddressCountry: string;
}

/** Props of the wizard's step 1 body (the type chooser). */
export interface CustomerTypeStepProps {
  /** Requests the next step; the body records the type and validates it first. */
  readonly onNext: () => void;
}

/** Props of the wizard's steps 2 and 3 — both are a real `useAppForm`. */
export interface CustomerWizardStepFormProps {
  /** Requests the next step after the values were written into the draft. */
  readonly onNext: () => void;
  /** Requests the previous step (one URL write). */
  readonly onBack: () => void;
  /** The failure this step has to show, or `undefined` when it has none (`D8`). */
  readonly serverError?: unknown;
}

/**
 * Props of the wizard's review step (step 4).
 *
 * The step owns the **one** `POST /api/admin/customers` (`D-W6`) and the jump to
 * `/customers/:id?tab=contacts` after it resolves. A rejection is reported to the
 * page, because only the page knows which step the failure belongs to and may
 * navigate there (`D8`); the page hands back the copy to render when the failure
 * stays on this step.
 */
export interface CustomerReviewStepProps {
  /** Requests the previous step (one URL write). */
  readonly onBack: () => void;
  /** Jumps to the first step, for a draft that is still incomplete. */
  readonly onRestart: () => void;
  /** Reports a failed create; the page routes it to the step that can fix it. */
  readonly onServerError: (error: unknown) => void;
  /** The failure to render on this step, or `undefined` when it belongs elsewhere. */
  readonly serverError?: unknown;
}
