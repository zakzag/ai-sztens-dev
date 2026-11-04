/**
 * Types of the `api-keys` page.
 *
 * Page-local by design: nothing outside `pages/api-keys/` needs these shapes.
 */

import type { ReactNode } from 'react';
import type { DataTableSort } from '@callback/ui';
import type {
  ApiKeyDetailViewModel,
  ApiKeyViewModels,
} from '../../entities/api-key/api-key.interface.js';
import type {
  ApiKeyEditFormFieldName,
  ApiKeyFormFieldName,
} from '../../features/api-keys/api-keys.interface.js';

/**
 * The five form fields, exactly as react-hook-form holds them.
 *
 * Every field is a **string**, including the date: an `<input type="date">`
 * produces `YYYY-MM-DD` (or `''`), never a `Date`. The conversion to the wire
 * format happens once, in `toCreateApiKeyInput`.
 *
 * Fields are mutable (not `readonly`) because react-hook-form writes into this
 * object through `setValue`/`reset`. Derived from {@link ApiKeyFormFieldName},
 * the union the feature maps server `path`s onto, so a field added or renamed on
 * one side cannot silently diverge from the other.
 */
export type ApiKeyFormValues = Record<ApiKeyFormFieldName, string>;

/**
 * Props of the list part of the page.
 *
 * The failure is **not** one of them: the error state moved to the page level
 * (`PageErrorState`, plan `D11` tier 2), because a list error is the page's data
 * being unavailable, not a property of the table.
 *
 * The pager is a **slot** (`pagination`) rather than a `meta` prop, so this
 * component stays unaware of the pager contract: the page decides whether a
 * pager exists at all (`meta === null` while loading).
 */
export type ApiKeyEditFormValues = Record<ApiKeyEditFormFieldName, string>;

/**
 * Props of the read-only detail card.
 *
 * The view model is already formatted (AIS-131): a description is never `null`
 * and the expiry verdict is a badge model, so this component decides no colour,
 * no label and no emptiness rule. The delete **request** is a callback: the card
 * does not own a mutation, the page does.
 */
export interface ApiKeyDetailCardProps {
  /** The key, mapped by `toApiKeyDetailViewModel`. */
  readonly viewModel: ApiKeyDetailViewModel;
  /** Asks the page to open the confirmation dialog. */
  readonly onRequestDelete: () => void;
  /** `true` while the delete request is in flight; the button is disabled. */
  readonly isDeleting: boolean;
}

/**
 * Props of the edit form.
 *
 * Values arrive as plain form values, not as the wire row: the token (`apiKey`)
 * must not reach the component at all, and the expiry is already a calendar day
 * that an `<input type="date">` can display.
 */
export interface ApiKeyEditFormProps {
  /** Initial values, derived from the current version of the row. */
  readonly values: ApiKeyEditFormValues;
  /**
   * Performs the write.
   *
   * Owned by the page, because the `updatedAt` concurrency token and the
   * `STALE_WRITE` decision belong to the page: the form declares *what* it
   * submits, the page knows *which version* it edits. The callback must reject
   * with the raw error — `useAppForm` maps it onto the fields.
   */
  readonly submit: (values: ApiKeyEditFormValues) => Promise<unknown>;
  /** Runs after a successful save (the page shows the confirmation). */
  readonly onSaved: () => void;
}

/**
 * Props of the delete confirmation.
 *
 * `open` is owned by the page: only the page knows whether the mutation
 * succeeded, and the dialog must stay open on failure (AIS-117 `D4`).
 */
export interface ApiKeyDeleteDialogProps {
  /** Whether the dialog is visible. */
  readonly open: boolean;
  /** Reports a close request (`Esc`, the cancel button, the overlay). */
  readonly onOpenChange: (open: boolean) => void;
  /** Confirms the deletion; the dialog stays open until the page closes it. */
  readonly onConfirm: () => void;
  /** `true` while the request is in flight. */
  readonly isPending: boolean;
  /** Page-level failure text, rendered inside the dialog; `null` when none. */
  readonly errorMessage: string | null;
}

export interface ApiKeysTableProps {
  /** Already mapped rows; the table never sees the wire `apiKey` field. */
  readonly apiKeys: ApiKeyViewModels;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** The sort the URL currently asks for, shown on the column headers. */
  readonly sort: DataTableSort;
  /** Reports a sort request; the page turns it into a URL patch. */
  readonly onSortChange: (sort: DataTableSort) => void;
  /** The pager, rendered under the table when the page has a `meta`. */
  readonly pagination?: ReactNode;
}
