/**
 * The appearance contract of the design tokens (AIS-165).
 *
 * A {@link ThemeName} is the value of the `data-theme` attribute on `<html>`,
 * and every member has a matching token block in
 * `packages/ui/src/styles/theme.css`. The two sides cannot drift silently: the
 * `theme-tokens` quality gate (AIS-168) fails the build when a block does not
 * declare exactly the tokens the default appearance declares.
 *
 * The type lives in `packages/ui` because the token file does; **applying** an
 * appearance is a browser concern and belongs to the consuming app
 * (`apps/admin/src/app/theme/`), which is why nothing here touches the DOM,
 * `localStorage` or React.
 */

/**
 * One selectable appearance.
 *
 * `dark` is the value the `@theme` block itself carries, so an `<html>` element
 * with no `data-theme` attribute renders exactly that appearance. `glass` adds a
 * translucent, blurred variant on top of the token contract rather than a fourth
 * colour axis (AIS-166).
 */
export type ThemeName = 'light' | 'dark' | 'ambient' | 'glass';
