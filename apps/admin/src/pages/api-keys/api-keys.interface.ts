/**
 * Types of the `api-keys` page.
 *
 * Page-local by design: nothing outside `pages/api-keys/` needs these shapes.
 */

import type { ReactNode } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { ApiKey } from '@callback/shared';
import type { DataTableSort } from '@callback/ui';
import type {
  ApiKeyDetailViewModel,
  ApiKeyViewModels,
} from '../../entities/api-key/api-key.interface.js';
import type {
  ApiKeyEditFieldName,
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
export type ApiKeyEditValues = Record<ApiKeyEditFieldName, string>;

/**
 * Props of the edit overlay's form window (AIS-172).
 *
 * The window owns `useAppForm` and the `<form>`; the route element
 * (`ApiKeyEditDialog`) owns the detail query and the failure states, so this
 * component is only mounted when the row exists. It receives the **row**, not
 * pre-mapped form values: the `updatedAt` concurrency token and the value
 * mapping both belong to this half — the token never reaches an input, and the
 * expiry is converted once, by `toApiKeyEditValues`.
 */
export interface ApiKeyEditDialogFormProps {
  /** The current version of the row the overlay was opened for. */
  readonly data: ApiKey;
  /** `:identifier` from the URL — the address the `PATCH` is sent to. */
  readonly identifier: string;
  /** Closes the overlay (runs after a successful save and on every dismiss). */
  readonly onClose: () => void;
  /**
   * Re-reads the row after a refused write.
   *
   * A `409 STALE_WRITE` means somebody saved the same key first, so the version
   * the form carries is dead. The store is not patched (invalidation only runs
   * after a successful write), hence the explicit re-read: it brings the new
   * `updatedAt`, the parent remounts this window, and the user sees the values
   * they lost the race to instead of a snapshot that can never be saved again.
   */
  readonly onStaleWrite: () => void;
}

/**
 * Props of the create form **fields** (AIS-155).
 *
 * The form state (`useAppForm`) is owned by the create overlay, not by this
 * component: only the owner can hand `isSubmitting` to the overlay's footer
 * submit button, and only the owner decides what happens after a successful
 * submit. The fields component therefore receives the two RHF handles and the
 * residue message, and renders nothing else.
 */
export interface ApiKeyFormFieldsProps {
  /** Passes the react-hook-form registration to every control. */
  readonly register: UseFormRegister<ApiKeyFormValues>;
  /** Per-field messages, already mapped by the form pattern. */
  readonly errors: FieldErrors<ApiKeyFormValues>;
  /** Page-level copy for a failure no input owns; `null` when there is none. */
  readonly formError: string | null;
}

/**
 * Props of the read-only field block of one key (AIS-155).
 *
 * Shared by the legacy detail card and the read-only overlay, so the list of
 * fields, their labels and their formatting exist once.
 */
export interface ApiKeyDetailFieldsProps {
  /** The key, mapped by `toApiKeyDetailViewModel`. */
  readonly viewModel: ApiKeyDetailViewModel;
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
