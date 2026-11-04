import type { FormFieldProps } from './form-field.interface.js';

/**
 * Label + control + message wrapper — the single place where `aria-invalid`
 * and `aria-describedby` are wired for form fields.
 *
 * The control is provided through a render prop instead of `cloneElement`, so
 * the wiring stays explicitly typed and no child is mutated behind the caller's
 * back (decision **D1** of the AIS-113 plan).
 *
 * ```tsx
 * <FormField id="role" label="Szerep" error={errors.role}>
 *   {(field) => <Select {...field} options={options} />}
 * </FormField>
 * ```
 *
 * @param props - see {@link FormFieldProps}.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  children,
}: FormFieldProps) {
  const hasError = Boolean(error);
  const describedBy = hasError
    ? `${id}-error`
    : hint
      ? `${id}-hint`
      : undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-text-secondary"
      >
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
            <span className="sr-only"> (kötelező)</span>
          </>
        ) : null}
      </label>
      {children({
        id,
        invalid: hasError,
        describedBy,
        ariaProps: {
          id,
          'aria-invalid': hasError || undefined,
          'aria-describedby': describedBy,
        },
      })}
      {hasError ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
