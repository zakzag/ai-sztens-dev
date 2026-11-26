import type { PaginationLimitSelectorProps } from './pagination.interface.js';
import {
  PAGINATION_LIMIT_ID,
  PAGINATION_LIMIT_LABEL,
  PAGINATION_SELECT_CLASSES,
} from './pagination.const.js';
import { clampLimit } from './pagination.logic.js';

/**
 * Page-size selector.
 *
 * The `<select>` value is clamped onto the options (`clampLimit`): a `value` the
 * options do not contain makes the control render empty, which is exactly the
 * defect a deep link with `?limit=30` would produce.
 *
 * @param props - see {@link PaginationLimitSelectorProps}.
 */
export function PaginationLimitSelector({
  limit,
  options,
  onLimitChange,
}: PaginationLimitSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={PAGINATION_LIMIT_ID} className="text-sm text-text-secondary">
        {PAGINATION_LIMIT_LABEL}
      </label>
      <select
        id={PAGINATION_LIMIT_ID}
        className={PAGINATION_SELECT_CLASSES}
        value={clampLimit(limit, options)}
        onChange={(event) => {
          onLimitChange(Number(event.target.value));
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
