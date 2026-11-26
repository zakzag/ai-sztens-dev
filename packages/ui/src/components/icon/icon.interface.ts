/**
 * Props shared by every icon of the `@callback/ui` icon set.
 *
 * There is deliberately **no** `size` and no `color` prop:
 *
 * - the size is a Tailwind class merged after the icon's base class, so the
 *   caller overrides the default with a normal utility (`h-6 w-6`);
 * - the colour comes from `stroke="currentColor"`, so an icon always follows
 *   the text token of the element it sits in and can never introduce a
 *   colour literal.
 */
export interface IconProps {
  /**
   * Extra classes merged **after** the base class (default size +
   * `shrink-0`), so the caller's utility wins on conflicts.
   */
  readonly className?: string;
}
