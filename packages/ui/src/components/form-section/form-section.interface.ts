import type { ReactNode } from 'react';

/**
 * Props of {@link FormSection}.
 *
 * `legend` is required: an unnamed `<fieldset>` is an accessibility defect, and
 * a group of controls without a heading is hard to scan.
 */
export interface FormSectionProps {
  /** Group heading, rendered as the `<legend>` of the fieldset. */
  readonly legend: string;
  /** Optional sentence under the legend explaining the group. */
  readonly description?: string;
  /** The fields that belong to this group. */
  readonly children: ReactNode;
}
