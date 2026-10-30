/**
 * Types of the `api-keys` page.
 *
 * Page-local by design: nothing outside `pages/api-keys/` needs these shapes.
 */

import type { ApiKeyViewModels } from '../../entities/api-key/api-key.interface.js';
import type { ApiKeyFormFieldName } from '../../features/api-keys/api-keys.interface.js';

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
 */
export interface ApiKeysTableProps {
  /** Already mapped rows; the table never sees the wire `apiKey` field. */
  readonly apiKeys: ApiKeyViewModels;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
}
