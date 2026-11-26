/**
 * The pure half of {@link useAppForm} (AIS-115, plan `D6`; surface rule AIS-85 `D2`).
 *
 * `toFieldErrors` (AIS-111) answers *which paths, with what copy*; react-hook-form
 * needs a **sequence** instead of a keyed object, because the order decides focus
 * (plan `D3`). That translation — order the entries, drop what the form does not
 * own, keep the page-level message — is the only decision left, and it lives here
 * so it can be asserted without React.
 *
 * The page-level message is also the place where the notification system and the
 * form would otherwise speak twice, so *who is allowed to speak* is decided here
 * too: `toErrorSurface` (`lib/error-surface.logic.ts`) classifies the failure once,
 * and the form keeps the message **only** for a `field` failure that the mapping
 * could not address. Every other surface already has an owner — `page` → the
 * capture toast (AIS-84), `banner` → `AppErrorBanner` (AIS-96), `silent` → nobody,
 * because nothing happened.
 */

import type { ErrorSurface } from '../../lib/error-surface.interface.js';
import type { FieldErrorMapping } from '../../lib/field-errors.interface.js';
import type {
  FormErrorEntry,
  FormErrorPlan,
} from './use-app-form.interface.js';

/**
 * Turns a mapping into the ordered list react-hook-form will be fed.
 *
 * The order comes from `fieldPaths`, never from the object's own key order: the
 * latter is insertion order of whatever the server happened to send, so the
 * focused input would change between two identical failures.
 *
 * A path without a message is skipped rather than emitted with an empty one, so a
 * partially mapped failure cannot produce an error row with no text.
 *
 * @param mapping - the result of `toFieldErrors` for this form.
 * @param fieldPaths - every path the form owns, in visual order.
 * @param surface - the tier the classifier assigned to the same failure.
 * @returns the ordered field entries plus the page-level message; the message is
 *   `null` whenever another surface already owns it.
 */
export function toFormErrorPlan<F extends string>(
  mapping: FieldErrorMapping<F>,
  fieldPaths: readonly F[],
  surface: ErrorSurface,
): FormErrorPlan<F> {
  const entries: FormErrorEntry<F>[] = [];

  for (const path of fieldPaths) {
    const message = mapping.fields[path];

    if (message !== undefined) {
      entries.push({ path, message });
    }
  }

  return { entries, formMessage: surface === 'field' ? mapping.form : null };
}
