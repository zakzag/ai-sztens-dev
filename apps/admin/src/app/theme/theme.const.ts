/**
 * Browser-facing constants of the theme engine (AIS-165).
 *
 * The appearance **names** are owned by `@callback/ui` (`THEME_NAMES`): they are
 * the token contract, and the token file's `[data-theme=…]` blocks are named
 * after those very strings. What lives here is what only a browser can know —
 * the attribute name and the storage key — because `packages/ui` must not touch
 * the DOM or the storage (its layers are presentational and pure).
 */

/** The attribute the token blocks in `theme.css` switch on. */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * The `localStorage` key of the chosen appearance.
 *
 * The literal is duplicated by the boot script in
 * [`apps/admin/index.html`](../../../index.html:1), which has to run **before**
 * the bundle to keep the first paint flash-free. The storage test asserts this
 * exact key, and both sides carry this comment, so a rename cannot silently
 * split the script from the engine.
 */
export const THEME_STORAGE_KEY = 'aisztens.theme';
