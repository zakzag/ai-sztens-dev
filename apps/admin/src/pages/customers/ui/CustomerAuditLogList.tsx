/**
 * The read-only row list of the *Napló* tab (AIS-181 `D8`).
 *
 * Each row is a `LogEntryRow` — the same primitive the notification log uses, and
 * that is the whole point: it already renders a severity glyph, a badge text, a
 * timestamp, a sentence, an optional one-line detail and an **expandable** key–value
 * region with per-value pretty JSON and a copy control. The ledger needs exactly
 * that, so the tab adds no second renderer (the screen contract forbids one) and
 * `packages/ui` needs no new component.
 *
 * The operation's name goes into the badge through the `levelLabel` prop, and the
 * severity — which the glyph and `data-level` carry — stays the operation's own
 * mapping: `insert` is a success, a correction is information, a deletion is a
 * warning. Nothing here can write: the component renders no action, and the module
 * graph of the tab imports no mutation at all.
 */

import { LogEntryRow, Skeleton } from '@callback/ui';
import type { LogEntryItem } from '@callback/ui';
import { toAuditLogEntryItem } from '../customer-audit-log.logic.js';
import { CUSTOMER_AUDIT_LIST_LABEL } from '../customers.const.js';
import type { CustomerAuditLogListProps } from '../customers.interface.js';

/**
 * @param props - see {@link CustomerAuditLogListProps}.
 */
export function CustomerAuditLogList({
  rows,
  isLoading,
  empty,
}: CustomerAuditLogListProps) {
  if (isLoading) {
    return <Skeleton lines={6} />;
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <ol className="space-y-2" aria-label={CUSTOMER_AUDIT_LIST_LABEL}>
      {rows.map((row) => {
        const entry: LogEntryItem = toAuditLogEntryItem(row);

        return (
          <li key={row.id}>
            {/*
              The mapper already formatted the instant once (`occurredAtText`), so
              the row's timestamp formatter is that string and not a second
              `Intl` call that could disagree with it.
            */}
            <LogEntryRow
              entry={entry}
              formatTimestamp={() => row.occurredAtText}
              levelLabel={row.operationLabel}
            />
          </li>
        );
      })}
    </ol>
  );
}
