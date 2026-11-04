import { Button, Card, DescriptionList, StatusBadge } from '@callback/ui';
import type { DescriptionListItem } from '@callback/ui';
import {
  API_KEY_DELETE_LABEL,
  API_KEY_DETAIL_FIELD_LABELS,
} from '../api-keys.const.js';
import type { ApiKeyDetailCardProps } from '../api-keys.interface.js';

/**
 * Read-only card of one stored API key (AIS-131).
 *
 * The component renders the view model it is given and nothing else: the
 * description is never `null`, the expiry verdict already carries its label and
 * `Badge` variant, and the token (`apiKey`) never reaches it because the mapper
 * drops it. That is what makes the card safe to assert on in a test.
 *
 * The delete **request** is a callback, not a mutation: a presentational part
 * must not know how to talk to the backend (D2 of the AIS-131 plan). The page
 * owns the confirmation dialog, the mutation and the navigation that follows.
 *
 * @param props - see {@link ApiKeyDetailCardProps}.
 */
export function ApiKeyDetailCard({
  viewModel,
  onRequestDelete,
  isDeleting,
}: ApiKeyDetailCardProps) {
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
    <Card className="space-y-4">
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

      <div className="flex justify-end">
        <Button variant="danger" onClick={onRequestDelete} disabled={isDeleting}>
          {API_KEY_DELETE_LABEL}
        </Button>
      </div>
    </Card>
  );
}
