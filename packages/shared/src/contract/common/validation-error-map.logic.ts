/**
 * Translation of a zod issue into a catalogue message (AIS-112 plan `D2`).
 *
 * The *rules* live in the schemas; this module only decides **which sentence**
 * describes a zod-generated issue. Keeping it separate from
 * [`validation-error-map.const.ts`](packages/shared/src/contract/common/validation-error-map.const.ts:1)
 * makes the mapping a pure function that can be unit tested issue by issue,
 * without a schema in the way.
 */

import type { ZodIssueOptionalMessage } from 'zod';
import { resolveMessage } from './validation-message.helper.js';

/**
 * @param validation - the `validation` field of an `invalid_string` issue.
 * @returns the catalogue sentence for the violated string rule.
 */
function toInvalidStringMessage(validation: unknown): string {
  if (typeof validation !== 'string') {
    return resolveMessage('INVALID_FORMAT');
  }

  switch (validation) {
    case 'email':
      return resolveMessage('EMAIL');
    case 'url':
      return resolveMessage('URL');
    default:
      return resolveMessage('INVALID_FORMAT');
  }
}

/**
 * @param issue - one entry of a failed parse.
 * @returns the sentence to show, or `null` when the issue carries its own
 *   message (a `custom` issue, or any rule the schema already messaged) — in
 *   that case zod keeps the schema's text and this map must not override it.
 */
export function toValidationErrorMessage(
  issue: ZodIssueOptionalMessage,
): string | null {
  switch (issue.code) {
    case 'invalid_type':
      return issue.received === 'undefined' || issue.received === 'null'
        ? resolveMessage('REQUIRED')
        : resolveMessage('INVALID_TYPE');

    case 'too_small':
      if (typeof issue.minimum !== 'number') {
        return resolveMessage('INVALID_FORMAT');
      }

      return issue.type === 'string' && issue.minimum === 1
        ? resolveMessage('REQUIRED')
        : resolveMessage('TOO_SHORT_TEMPLATE', { min: issue.minimum });

    case 'too_big':
      return typeof issue.maximum === 'number'
        ? resolveMessage('TOO_LONG_TEMPLATE', { max: issue.maximum })
        : resolveMessage('INVALID_FORMAT');

    case 'invalid_string':
      return toInvalidStringMessage(issue.validation);

    case 'invalid_date':
    case 'invalid_enum_value':
    case 'invalid_literal':
      return resolveMessage('INVALID_FORMAT');

    case 'unrecognized_keys':
      return resolveMessage('INVALID_FORMAT');

    default:
      return null;
  }
}
