/**
 * Parsed parts of a Hungarian tax number (`XXXXXXXX-Y-ZZ`).
 *
 * A named type instead of an inline shape, so the parser, the check-digit
 * helper and their tests all speak about the same three fields.
 */
export interface HuTaxNumberParts {
  /** The eight-digit body, whose last digit is the check digit. */
  readonly body: string;
  /** VAT code (`-Y-`), 1–5 for a live taxpayer. */
  readonly vatCode: number;
  /** Area code (`-ZZ`), the tax office that registered the taxpayer. */
  readonly areaCode: number;
}
