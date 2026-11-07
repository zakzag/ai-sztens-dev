import { DescriptionList, StatusBadge } from '@callback/ui';
import type { DescriptionListItem } from '@callback/ui';
import { API_KEY_DETAIL_FIELD_LABELS } from '../api-keys.const.js';
import type { ApiKeyDetailFieldsProps } from '../api-keys.interface.js';

/**
 * The read-only field block of one stored key (AIS-155).
 *
 * Extracted from `ApiKeyDetailCard` so the legacy detail page and the read-only
 * overlay render **the same** labels, order and formatting: two copies of a field
 * list drift the moment one of them gains a row. The component decides no
 * colour, no label and no emptiness rule — the view model is already formatted
 * (AIS-131) and the token (`apiKey`) never reaches it, because the mapper drops
 * it.
 *
 * @param props - see {@link ApiKeyDetailFieldsProps}.
 * @returns the expiry verdict plus the description list of the key.
 */
export function ApiKeyDetailFields({ viewModel }: ApiKeyDetailFieldsProps) {
  const items: readonly DescriptionListItem[] = [
    {
      label: API_KEY_DETAIL_FIELD_LABELS.name,
      value: viewModel.name,
    },
    {
      label: API_KEY_DETAIL_FIELD_LABELS.identifier,
      value: viewModel.identifier,
    },
    {
      label: API_KEY_DETAIL_FIELD_LABELS.description,
      value: viewModel.description,
    },
    {
      label: API_KEY_DETAIL_FIELD_LABELS.expiresAt,
      value: viewModel.expiresAtLabel,
    },
    {
      label: API_KEY_DETAIL_FIELD_LABELS.createdAt,
      value: viewModel.createdAtLabel,
    },
    {
      label: API_KEY_DETAIL_FIELD_LABELS.updatedAt,
      value: viewModel.updatedAtLabel,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {API_KEY_DETAIL_FIELD_LABELS.expiry}
        </span>
        <StatusBadge
          status={viewModel.expiry.status}
          label={viewModel.expiry.label}
          variant={viewModel.expiry.variant}
        />
      </div>

      <DescriptionList items={items} columns={2} />
    </div>
  );
}
