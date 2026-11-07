import { Button, Card } from '@callback/ui';
import {
  API_KEY_DELETE_LABEL,
} from '../api-keys.const.js';
import type { ApiKeyDetailCardProps } from '../api-keys.interface.js';
import { ApiKeyDetailFields } from './ApiKeyDetailFields.js';

/**
 * Read-only card of one stored API key (AIS-131).
 *
 * The card renders the view model it is given and nothing else: the field block
 * is {@link ApiKeyDetailFields} (shared with the read-only overlay of AIS-155),
 * so the two surfaces can never show a different set of rows.
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
  return (
    <Card className="space-y-4">
      <ApiKeyDetailFields viewModel={viewModel} />

      <div className="flex justify-end">
        <Button variant="danger" onClick={onRequestDelete} disabled={isDeleting}>
          {API_KEY_DELETE_LABEL}
        </Button>
      </div>
    </Card>
  );
}
