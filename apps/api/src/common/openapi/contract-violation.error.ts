/**
 * A response that breaks the shared contract, detected in dev (AIS-98, plan
 * §8.4 job 4).
 *
 * It is deliberately an `AppError` with `INTERNAL_ERROR`: a contract violation is
 * a server bug, not a client mistake, and the existing filter already sanitises
 * `5xx` bodies while logging the detail. The *message* (which field of which
 * operation) is what a developer needs, and it stays in the log; the response
 * carries only `INTERNAL_ERROR` + `requestId`, exactly like any other 500.
 */

import { API_ERROR_CODE } from '@callback/shared';
import { AppError } from '../http/app-error.js';

export class ContractViolationError extends AppError {
  /**
   * @param operationId - registry id of the endpoint that produced the body.
   * @param issues - human readable list of the schema violations.
   */
  constructor(operationId: string, issues: readonly string[]) {
    super({
      code: API_ERROR_CODE.INTERNAL_ERROR,
      message: `response of "${operationId}" does not match its contract: ${issues.join('; ')}`,
    });
    this.name = 'ContractViolationError';
  }
}
