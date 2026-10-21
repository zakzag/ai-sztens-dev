/**
 * Types of the `api-keys` page.
 *
 * Page-local by design: nothing outside `pages/api-keys/` needs these shapes.
 */

import type { ApiKeyViewModels } from '../../entities/api-key/api-key.interface.js';

/**
 * The five form fields, exactly as react-hook-form holds them.
 *
 * Every field is a **string**, including the date: an `<input type="date">`
 * produces `YYYY-MM-DD` (or `''`), never a `Date`. The conversion to the wire
 * format happens once, in `toCreateApiKeyInput`.
 *
 * Fields are mutable (not `readonly`) because react-hook-form writes into this
 * object through `setValue`/`reset`.
 */
export interface ApiKeyFormValues {
  name: string;
  identifier: string;
  description: string;
  apiKey: string;
  expiresAt: string;
}

/** Props of the list part of the page — all four async states are driven here. */
export interface ApiKeysTableProps {
  /** Already mapped rows; the table never sees the wire `apiKey` field. */
  readonly apiKeys: ApiKeyViewModels;
  /** `true` until the first response (or failure) arrives. */
  readonly isLoading: boolean;
  /** User-facing load error, or `null`. */
  readonly error: string | null;
  /** Retry handler for the error state. */
  readonly onRetry: () => void;
}
