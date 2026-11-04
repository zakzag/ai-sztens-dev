/**
 * Pure wire → view-model mapping of an API key.
 *
 * Two responsibilities, both testable with values alone:
 * - the token (`apiKey`) is **dropped**, so it cannot reach the DOM (D33);
 * - `expiresAt` is formatted through `lib/date.ts`, which is the only module
 *   that knows about the local⇄UTC conversion (D6).
 */

import type { ApiKey } from '@callback/shared';
import { formatDateTime, formatExpiry } from '../../lib/date.js';
import { INVALID_EXPIRY_LABEL } from '../../lib/date.const.js';
import {
  EMPTY_VALUE_LABEL,
  EXPIRY_ACTIVE_LABEL,
  EXPIRY_EXPIRED_LABEL,
  EXPIRY_NONE_LABEL,
} from './api-key.const.js';
import type {
  ApiKeyDetailViewModel,
  ApiKeyExpiryBadge,
  ApiKeyViewModel,
  ApiKeyViewModels,
} from './api-key.interface.js';

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

/**
 * Turns `expiresAt` into the badge the detail page renders (AIS-131, D9).
 *
 * The verdict is derived, never stored: the API keeps a timestamp only, so a
 * `status` field here would be a second source of truth that could disagree with
 * the date next to it.
 *
 * An unparsable value is **not** treated as expired: it is a contract
 * violation, and saying “lejárt” would make the user delete a key that is
 * probably fine. It gets its own warning badge instead.
 *
 * @param expiresAt - ISO instant from the wire, or `null` for “no expiry”.
 * @param now - current epoch milliseconds; injected so the rule is testable.
 * @returns the badge model; `active` on the exact boundary instant.
 */
export function toExpiryBadge(
  expiresAt: string | null,
  now: number,
): ApiKeyExpiryBadge {
  if (expiresAt === null) {
    return {
      status: 'none',
      label: EXPIRY_NONE_LABEL,
      variant: 'neutral',
    };
  }

  const instant = new Date(expiresAt).getTime();

  if (Number.isNaN(instant)) {
    return {
      status: 'unknown',
      label: INVALID_EXPIRY_LABEL,
      variant: 'warning',
    };
  }

  if (instant < now) {
    return {
      status: 'expired',
      label: EXPIRY_EXPIRED_LABEL,
      variant: 'warning',
    };
  }

  return {
    status: 'active',
    label: EXPIRY_ACTIVE_LABEL,
    variant: 'success',
  };
}

/**
 * Maps one wire row onto the detail view model.
 *
 * @param dto - the payload of `GET /api/api-keys/:identifier`.
 * @param now - current epoch milliseconds (defaults to the wall clock so the
 *   production path stays a one-argument call).
 * @returns the renderable view model; the `apiKey` token is not copied.
 */
export function toApiKeyDetailViewModel(
  dto: ApiKey,
  now: number = Date.now(),
): ApiKeyDetailViewModel {
  const description = dto.description?.trim() ?? '';

  return {
    name: dto.name,
    identifier: dto.identifier,
    description: description.length > 0 ? description : EMPTY_VALUE_LABEL,
    expiresAtLabel: formatExpiry(dto.expiresAt),
    createdAtLabel: formatDateTime(dto.createdAt),
    updatedAtLabel: formatDateTime(dto.updatedAt),
    expiry: toExpiryBadge(dto.expiresAt, now),
  };
}
