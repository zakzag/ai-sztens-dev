/**
 * Fixtures of the shared form pattern tests (AIS-115).
 *
 * A deliberately **generic** three-field form: no `api-keys` vocabulary, so a test
 * that passes with this fixture proves the hook knows no domain field names
 * (plan `D1`). Everything a form has to declare — schema, defaults, ordered field
 * paths, code → path map — is here, never inline in a test file.
 */

import { API_ERROR_CODE } from '@callback/shared';
import { z } from 'zod';
import type { ZodType } from 'zod';

/** The three inputs of the fixture form, in visual order. */
export const APP_FORM_FIELD_NAMES = ['name', 'email', 'note'] as const;

/** Union of the fixture form's field names. */
export type AppFormFieldName = (typeof APP_FORM_FIELD_NAMES)[number];

/** The values react-hook-form holds for the fixture form. */
export type AppFormValues = Record<AppFormFieldName, string>;

/** The declared order, which is also the focus order (plan `D3`). */
export const APP_FORM_FIELD_PATHS: readonly AppFormFieldName[] = Object.freeze([
  ...APP_FORM_FIELD_NAMES,
]);

/** Defaults that fail the schema — an empty submit must be blocked client-side. */
export const APP_FORM_EMPTY_VALUES: AppFormValues = Object.freeze({
  name: '',
  email: '',
  note: '',
});

/** Defaults that pass the schema — used to reach the submit callback. */
export const APP_FORM_FILLED_VALUES: AppFormValues = Object.freeze({
  name: 'Teszt Elek',
  email: 'teszt@pelda.hu',
  note: 'megjegyzes',
});

/** Labels the harness renders; the tests find inputs through them. */
export const APP_FORM_LABELS: Readonly<Record<AppFormFieldName, string>> =
  Object.freeze({ name: 'Név', email: 'E-mail', note: 'Megjegyzés' });

/** Submit button label. */
export const APP_FORM_SUBMIT_LABEL = 'Mentés';

/** Submit button label while the request is in flight. */
export const APP_FORM_PENDING_LABEL = 'Mentés folyamatban…';

/** Copy handed to the notification port after a successful submit. */
export const APP_FORM_SUCCESS_MESSAGE = 'A rekord elmentve.';

/** Label of the harness button that calls `setServerError` directly. */
export const APP_FORM_EXTERNAL_ERROR_LABEL = 'Külső hiba szimulálása';

/**
 * The fixture schema — three required strings, no domain rule.
 *
 * `min(1)` is enough: the point is that the **client** blocks the submit with the
 * shared Hungarian copy, which the `too_small` → `REQUIRED` mapping provides.
 */
export const APP_FORM_SCHEMA: ZodType<AppFormValues> = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  note: z.string().min(1),
});

/**
 * Code → path map of the fixture, standing in for a feature's own decision.
 *
 * `API_KEY_IDENTIFIER_CONFLICT` is used only because it is the one catalogue code
 * whose default path the fixture can plausibly own; the hook must forward the map
 * untouched, whatever the codes are.
 */
export const APP_FORM_DEFAULT_PATH_BY_CODE: Readonly<
  Record<string, AppFormFieldName>
> = Object.freeze({
  [API_ERROR_CODE.API_KEY_IDENTIFIER_CONFLICT]: 'name',
});
