/**
 * One policy for every self-skipping e2e gate.
 *
 * The problem
 * -----------
 * The e2e gates (`app-module-gate`, `database-gate`) introduced "loud skip"
 * semantics so a bare checkout does not report a red suite for an environment
 * it does not have. The side effect is that a run can print
 * `18 passed, 140 passed` while **no test executed** — which happened on a
 * Node 20 shell and hid 96 real failures until the same command ran on Node 24.
 *
 * The rule
 * --------
 * Skipping is a **local convenience only**. In CI (`CI=true`, set by every
 * mainstream runner) a missing prerequisite must fail the run instead: a green
 * build that proves nothing is worse than a red one that names the reason.
 *
 * The check reads `process.env` at call time (not at module load) so the policy
 * itself is unit-testable without re-importing the module.
 */

/**
 * @returns `true` when a skip must be reported as a failure (CI).
 */
export function isSkipFatal(): boolean {
  return process.env['CI'] === 'true';
}

/**
 * Reports a skipped prerequisite: warns locally, throws in CI.
 *
 * @param context - the bracketed subsystem tag, e.g. `'[app-module-gate]'`.
 * @param reason - the operator-facing explanation of what is missing.
 * @throws {Error} when {@link isSkipFatal} is `true`.
 */
export function reportSkip(context: string, reason: string): void {
  if (isSkipFatal()) {
    throw new Error(`${context} ${reason}`);
  }

  console.warn(`${context} ${reason}`);
}
