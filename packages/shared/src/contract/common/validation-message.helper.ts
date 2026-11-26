/**
 * Locale handling and message resolution of the shared validation copy
 * (AIS-112 plan decision `D8`).
 *
 * Why module state: zod needs a **string** at parse time, but the same schema
 * object must serve two audiences. The compromise is one explicit, documented
 * switch:
 *
 * - the default is `en`, so the API (`apps/api`) never produces Hungarian text
 *   in `details[].message` — that field is developer-facing;
 * - the admin SPA calls {@link configureValidationLocale}('hu') once at
 *   bootstrap, so every validation message rendered in the browser is
 *   Hungarian.
 *
 * The state is never written implicitly: the only writers are the two functions
 * below, and {@link resetValidationLocale} exists so a test can prove the
 * default English behaviour.
 */

import { VALIDATION_MESSAGE_CATALOGUE } from './validation-message.const.js';
import type {
  ValidationLocale,
  ValidationMessageKey,
  ValidationMessageParams,
} from './validation-message.interface.js';

/** The language a process starts with — internal copy, never user copy. */
const DEFAULT_VALIDATION_LOCALE: ValidationLocale = 'en';

/** Current locale; mutated only through the two functions below. */
let currentLocale: ValidationLocale = DEFAULT_VALIDATION_LOCALE;

/**
 * Switches the language of every validation message produced from now on.
 *
 * @param locale - the language to use; `'hu'` for the browser bundle.
 */
export function configureValidationLocale(locale: ValidationLocale): void {
  currentLocale = locale;
}

/** Restores the default (`en`) locale; used by tests, not by the app. */
export function resetValidationLocale(): void {
  currentLocale = DEFAULT_VALIDATION_LOCALE;
}

/**
 * @returns the language currently in use.
 */
export function getValidationLocale(): ValidationLocale {
  return currentLocale;
}

/**
 * Substitutes the `{min}` / `{max}` placeholders of a template.
 *
 * @param template - a catalogue entry, possibly containing placeholders.
 * @param params - values to substitute; an absent value leaves the placeholder
 *   untouched, which keeps an incomplete call visible instead of silently
 *   dropping the number.
 * @returns the interpolated sentence.
 */
export function formatMessage(
  template: string,
  params: ValidationMessageParams = {},
): string {
  return template
    .replace('{min}', params.min === undefined ? '{min}' : String(params.min))
    .replace('{max}', params.max === undefined ? '{max}' : String(params.max));
}

/**
 * Looks a key up in the active locale.
 *
 * @param key - catalogue key.
 * @param params - optional template values.
 * @returns the sentence to show.
 */
export function resolveMessage(
  key: ValidationMessageKey,
  params: ValidationMessageParams = {},
): string {
  return formatMessage(VALIDATION_MESSAGE_CATALOGUE[currentLocale][key], params);
}

