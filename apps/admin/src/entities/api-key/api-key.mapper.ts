/**
 * Pure wire → view-model mapping of an API key.
 *
 * Two responsibilities, both testable with values alone:
 * - the token (`apiKey`) is **dropped**, so it cannot reach the DOM (D33);
 * - `expiresAt` is formatted through `lib/date.ts`, which is the only module
 *   that knows about the local⇄UTC conversion (D6).
 */

import type { ApiKey } from '@callback/shared';
import { formatExpiry } from '../../lib/date.js';
import { EMPTY_VALUE_LABEL } from './api-key.const.js';
import type { ApiKeyViewModel, ApiKeyViewModels } from './api-key.interface.js';

/**
 * @param dto - one row of `GET /api/api-keys`.
 * @returns the renderable view model; the `apiKey` value is not copied.
 */
export function toApiKeyViewModel(dto: ApiKey): ApiKeyViewModel {
  const description = dto.description?.trim() ?? '';

  return {
    id: dto.id,
    name: dto.name,
    identifier: dto.identifier,
    description: description.length > 0 ? description : EMPTY_VALUE_LABEL,
    expiresAtLabel: formatExpiry(dto.expiresAt),
  };
}

/**
 * @param dtos - the list returned by `GET /api/api-keys` (newest first).
 * @returns the same order, mapped row by row.
 */
export function toApiKeyViewModels(dtos: readonly ApiKey[]): ApiKeyViewModels {
  return dtos.map(toApiKeyViewModel);
}
