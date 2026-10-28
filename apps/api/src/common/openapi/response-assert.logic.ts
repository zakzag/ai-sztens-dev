/**
 * The contract assertion itself (AIS-98, plan §8.4 job 4).
 *
 * Pure and synchronous: given a registry entry and the body a handler produced,
 * decide whether the body is what the shared contract promises. The interceptor
 * around it only has to read the route and pipe the observable.
 *
 * Two rules matter:
 *
 * - an **enveloped** entry is validated against the *whole* body
 *   (`successEnvelopeSchema`), so a forgotten `responses.ok()` — a bare payload —
 *   fails instead of shipping;
 * - unknown keys are **not** an error, because the response schemas deliberately
 *   strip them (an additive backend field must not break a deployed client);
 *   a *missing* or mistyped required field is.
 */

import { successEnvelopeSchema } from '@callback/shared';
import type { ApiEndpointContract } from '@callback/shared';
import { ContractViolationError } from './contract-violation.error.js';

/**
 * Renders one zod issue as `path: message`, with `<root>` for body-level issues.
 *
 * @param issue - a zod issue.
 * @returns a single-line, log-friendly description.
 */
function describeIssue(issue: {
  path: (string | number)[];
  message: string;
}): string {
  const path = issue.path.length === 0 ? '<root>' : issue.path.join('.');

  return `${path}: ${issue.message}`;
}

/**
 * Validates an outgoing body against its endpoint's contract.
 *
 * @param entry - the registry entry the request was routed to.
 * @param body - the body the handler produced.
 * @throws ContractViolationError when the body does not match the schema.
 */
export function assertResponseMatchesContract(
  entry: ApiEndpointContract,
  body: unknown,
): void {
  const schema = entry.envelope
    ? successEnvelopeSchema(entry.dataSchema)
    : entry.dataSchema;

  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ContractViolationError(
      entry.operationId,
      result.error.issues.map(describeIssue),
    );
  }
}
