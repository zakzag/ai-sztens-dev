/**
 * Status → code mapping for throwables that do not come from our own services
 * (Nest's `HttpException`, guards, the body-size limit).
 *
 * The direction of the mapping is deliberately one-way: **code decides status**
 * everywhere else (a `AppError` derives its status from the catalogue), so this
 * table only has to translate the few statuses Nest can produce into the closest
 * catalogue code. Anything unknown becomes `INTERNAL_ERROR`, because sending a
 * 4xx-looking status for an unhandled failure would hide a bug.
 */

import { API_ERROR_CODE, HTTP_STATUS } from '@callback/shared';
import type { ApiErrorCode } from '@callback/shared';

/**
 * The statuses Nest itself can produce, mapped onto the catalogue.
 *
 * `422` maps onto `VALIDATION_FAILED` as well: the catalogue has no dedicated
 * semantic-validation code yet, and leaving the status unmapped would turn a
 * Nest `UnprocessableEntityException` into a `500` — a client error reported as
 * a server failure. The status returned to the client is the catalogue's
 * (`400`), which is what `docs/Specs/API-Convention.md` documents.
 */
const STATUS_TO_CODE: Readonly<Record<number, ApiErrorCode>> = {
  [HTTP_STATUS.BAD_REQUEST]: API_ERROR_CODE.VALIDATION_FAILED,
  [HTTP_STATUS.UNAUTHORIZED]: API_ERROR_CODE.UNAUTHENTICATED,
  [HTTP_STATUS.FORBIDDEN]: API_ERROR_CODE.FORBIDDEN,
  [HTTP_STATUS.NOT_FOUND]: API_ERROR_CODE.NOT_FOUND,
  [HTTP_STATUS.CONFLICT]: API_ERROR_CODE.CONFLICT,
  [HTTP_STATUS.PAYLOAD_TOO_LARGE]: API_ERROR_CODE.PAYLOAD_TOO_LARGE,
  [HTTP_STATUS.UNPROCESSABLE_ENTITY]: API_ERROR_CODE.VALIDATION_FAILED,
  [HTTP_STATUS.TOO_MANY_REQUESTS]: API_ERROR_CODE.RATE_LIMITED,
  [HTTP_STATUS.SERVICE_UNAVAILABLE]: API_ERROR_CODE.SERVICE_UNAVAILABLE,
};

/**
 * @param status - status of a Nest exception.
 * @returns the catalogue code, or `INTERNAL_ERROR` when the status is not part
 *   of the contract (the envelope then reports `500`, which is the honest answer).
 */
export function toApiErrorCode(status: number): ApiErrorCode {
  return Object.hasOwn(STATUS_TO_CODE, status)
    ? STATUS_TO_CODE[status]
    : API_ERROR_CODE.INTERNAL_ERROR;
}
