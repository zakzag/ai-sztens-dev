/**
 * Document helpers of the theme tests (AIS-165).
 *
 * The engine's observable output is the `data-theme` attribute on `<html>`, so
 * every suite needs to read it and, more importantly, to **clear** it: jsdom
 * keeps the document for the whole file, and a leftover attribute would let a
 * later test pass without the provider doing anything.
 */

import { THEME_ATTRIBUTE } from '../../app/theme/theme.const.js';

/**
 * Reads the appearance currently applied to the document.
 *
 * @returns the attribute value, or `null` when no appearance is applied.
 */
export function readDocumentTheme(): string | null {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE);
}

/**
 * Removes the appearance attribute from `<html>`.
 *
 * Call it in `beforeEach` / `afterEach`: state leaking between tests is the
 * classic way a "the theme was applied" assertion becomes vacuous.
 */
export function resetDocumentTheme(): void {
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
}
