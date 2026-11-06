/**
 * Errors of the appearance selector (AIS-147).
 *
 * The `RadioGroup` primitive hands back a plain `string`, while the port of the
 * selector expects the `ThemeOption` union. A value outside that union means the
 * option list and the value type drifted apart — that is a programming error,
 * not user input, so it fails loudly instead of silently selecting nothing.
 */

/**
 * Thrown when a value that is not a declared appearance reaches the selector.
 */
export class InvalidThemeOptionError extends Error {
  /** The value that is not part of the `ThemeOption` union. */
  readonly value: string;

  /**
   * @param value - the rejected raw value.
   */
  constructor(value: string) {
    super(`"${value}" is not a valid theme option.`);
    this.name = 'InvalidThemeOptionError';
    this.value = value;
  }
}
