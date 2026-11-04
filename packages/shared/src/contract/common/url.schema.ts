/**
 * The shared URL schema (AIS-112).
 *
 * `z.string().url()` alone is not enough: it accepts anything `new URL()` can
 * parse, including `javascript:alert(1)` and `data:…`. A URL that reaches a
 * rendered `href` is an injection sink, so only the two navigation protocols
 * are allowed here — the rule lives in the contract, not in a component.
 */

import { z } from 'zod';
import { addValidationIssue } from './format-check.helper.js';
import { ALLOWED_URL_PROTOCOLS, URL_MAX_LENGTH } from './format.const.js';

/**
 * @param value - a string that already passed `z.string().url()`.
 * @returns `true` when the protocol is one a link may use.
 */
function hasAllowedProtocol(value: string): boolean {
  return ALLOWED_URL_PROTOCOLS.some((protocol) => value.startsWith(protocol));
}

/** Trimmed absolute `http(s)` URL. */
export const urlSchema = z
  .string()
  .trim()
  .max(URL_MAX_LENGTH)
  .url()
  .superRefine((value, ctx) => {
    if (!hasAllowedProtocol(value)) {
      addValidationIssue(ctx, 'URL');
    }
  });
