/**
 * One entry of the *Tevékenység* feed (AIS-181).
 *
 * The row is a `Card`: type badge, author and time in the header band, the text
 * below it (line breaks preserved — an operator's note is prose, not a label), and
 * the two actions on the header band's reading-end side.
 *
 * **The actions exist only when `canEdit` is true**, i.e. when the entry was written
 * by an operator (`D-W4`): the API checks no author until authentication lands
 * (AIS-73/74), so the screen is the only thing that stops an operator from rewriting
 * a customer's or the platform's entry.
 *
 * While the row is being edited the text is replaced by the inline editor and the
 * actions disappear — one row, one mode.
 */

import { Badge, Button, Card } from '@callback/ui';
import {
  CUSTOMER_ACTIVITY_DELETE_LABEL,
  CUSTOMER_ACTIVITY_EDIT_LABEL,
} from '../customers.const.js';
import type { CustomerActivityFeedItemProps } from '../customers.interface.js';
import { CustomerActivityEditForm } from './CustomerActivityEditForm.js';

/**
 * @param props - see {@link CustomerActivityFeedItemProps}.
 */
export function CustomerActivityFeedItem({
  customerId,
  activity,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onStaleWrite,
  onDelete,
}: CustomerActivityFeedItemProps) {
  return (
    <li>
      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={activity.typeVariant}>{activity.typeLabel}</Badge>
              <span className="text-sm font-medium text-text-primary">
                {activity.authorName}
              </span>
              <span className="text-xs text-text-muted">
                {activity.authorTypeText}
              </span>
              <time className="text-xs text-text-muted">
                {activity.createdAtText}
              </time>
            </div>

            {activity.canEdit && !isEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onStartEdit(activity.id);
                  }}
                >
                  {CUSTOMER_ACTIVITY_EDIT_LABEL}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onDelete(activity);
                  }}
                >
                  {CUSTOMER_ACTIVITY_DELETE_LABEL}
                </Button>
              </div>
            ) : null}
          </div>

          {isEditing ? (
            <CustomerActivityEditForm
              customerId={customerId}
              activity={activity}
              onCancel={onCancelEdit}
              onSaved={onSaved}
              onStaleWrite={onStaleWrite}
            />
          ) : (
            <p className="break-words whitespace-pre-line text-sm text-text-primary">
              {activity.body}
            </p>
          )}
        </div>
      </Card>
    </li>
  );
}
