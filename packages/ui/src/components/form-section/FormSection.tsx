import type { FormSectionProps } from './form-section.interface.js';

/**
 * Named group of form fields.
 *
 * A `<fieldset>` + `<legend>` pair instead of a styled `div` + `h3`: screen
 * readers announce the group name when focus enters it, which a heading does
 * not do.
 *
 * @param props - see {@link FormSectionProps}.
 */
export function FormSection({
  legend,
  description,
  children,
}: FormSectionProps) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-text-primary">
        {legend}
      </legend>
      {description ? (
        <p className="text-xs text-text-muted">{description}</p>
      ) : null}
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}
