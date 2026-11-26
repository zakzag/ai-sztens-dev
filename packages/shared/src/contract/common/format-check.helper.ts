/**
 * Reusable zod refinement steps for the common format rules (AIS-112).
 *
 * Why not `z.string().regex(PATTERN, 'message')`: an explicit string message is
 * evaluated **when the schema is built**, i.e. at import time, so it would be
 * frozen in the locale that happened to be active then. These helpers resolve
 * the sentence **at parse time** through {@link resolveMessage}, which is what
 * makes one schema object serve both the Hungarian UI and the English API.
 */

import type { RefinementCtx } from 'zod';
import { ZodIssueCode } from 'zod';
import { resolveMessage } from './validation-message.helper.js';
import type { ValidationMessageKey } from './validation-message.interface.js';

/**
 * Attaches a catalogue sentence as a custom issue.
 *
 * @param ctx - the refinement context zod hands to a check.
 * @param key - catalogue key of the sentence.
 */
export function addValidationIssue(
  ctx: RefinementCtx,
  key: ValidationMessageKey,
): void {
  ctx.addIssue({ code: ZodIssueCode.custom, message: resolveMessage(key) });
}

/**
 * Fails the value when it does not match a pattern.
 *
 * @param pattern - the rule itself (no `g` flag: a stateful `lastIndex` would
 *   make the check succeed and fail alternately).
 * @returns a check to pass to `superRefine`.
 */
export function patternCheck(
  pattern: RegExp,
  key: ValidationMessageKey,
): (value: string, ctx: RefinementCtx) => void {
  return (value, ctx) => {
    if (!pattern.test(value)) {
      addValidationIssue(ctx, key);
    }
  };
}
