import { cn } from '../../lib/cn.js';
import { TOAST_LEVEL_GLYPHS } from '../toast/toast.const.js';
import { toastLevelChipVariants } from '../toast/toast.variants.js';
import { LOG_LEVEL_LABELS } from './log-drawer.const.js';
import { logEntryRowVariants } from './log-drawer.variants.js';
import type { LogEntryRowProps } from './log-drawer.interface.js';

/**
 * One row of the log panel.
 *
 * Stateless and props-driven: the timestamp comes from the injected
 * `formatTimestamp`, the severity is rendered as a glyph **and** as text (colour
 * is never the only indicator, AIS-82 decision D9), and `detail` is added only
 * when the entry carries one.
 *
 * The glyph chip and the level palette are the `Toast` recipes on purpose: a
 * toast and its log row must never disagree about what "warning" looks like
 * (AIS-82 decision D8).
 *
 * @param props - see {@link LogEntryRowProps}.
 */
export function LogEntryRow({ entry, formatTimestamp }: LogEntryRowProps) {
  return (
    <div
      className={cn(logEntryRowVariants({ level: entry.level }))}
      data-level={entry.level}
    >
      <div className="flex items-center gap-2">
        <span
          className={toastLevelChipVariants({ level: entry.level })}
          aria-hidden="true"
        >
          {TOAST_LEVEL_GLYPHS[entry.level]}
        </span>
        <span className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
          {LOG_LEVEL_LABELS[entry.level]}
        </span>
        <time className="ml-auto shrink-0 text-xs text-text-muted">
          {formatTimestamp(entry.createdAt)}
        </time>
      </div>

      <p className="break-words">{entry.message}</p>

      {entry.detail ? (
        <p className="break-words text-xs text-text-secondary">{entry.detail}</p>
      ) : null}
    </div>
  );
}
