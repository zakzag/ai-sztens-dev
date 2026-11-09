import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { copyText } from '../../lib/copy-text.js';
import { NO_EXPANDED_JSON } from '../../lib/json.const.js';
import { toPrettyJson } from '../../lib/json.logic.js';
import { Button } from '../button/Button.js';
import { ChevronDownIcon } from '../icon/icons.js';
import { TOAST_LEVEL_GLYPHS } from '../toast/toast.const.js';
import { toastLevelChipVariants } from '../toast/toast.variants.js';
import {
  LOG_DETAIL_JSON_REGION_ID_SUFFIX,
  LOG_DETAIL_JSON_TOGGLE_LABEL_CLOSE,
  LOG_DETAIL_JSON_TOGGLE_LABEL_OPEN,
  LOG_ENTRY_COPY_DONE_LABEL,
  LOG_ENTRY_COPY_ENTRY_LABEL,
  LOG_ENTRY_COPY_FEEDBACK_MS,
  LOG_ENTRY_COPY_IDLE,
  LOG_ENTRY_COPY_REQUEST_ID_LABEL,
  LOG_ENTRY_DETAILS_EMPTY_ID_SUFFIX,
  LOG_ENTRY_DETAILS_EMPTY_LABEL,
  LOG_ENTRY_DETAILS_REGION_ID_SUFFIX,
  LOG_ENTRY_DETAILS_REGION_LABEL,
  LOG_LEVEL_LABELS,
} from './log-drawer.const.js';
import {
  findRequestIdField,
  toEntryJson,
  toEntryToggleLabel,
} from './log-drawer.logic.js';
import {
  logDetailFieldVariants,
  logDetailJsonPreVariants,
  logDetailJsonToggleVariants,
  logEntryChevronVariants,
  logEntryDetailsVariants,
  logEntryRowVariants,
  logEntryToggleVariants,
} from './log-drawer.variants.js';
import type {
  LogEntryCopyFlags,
  LogEntryCopyTarget,
  LogEntryRowProps,
} from './log-drawer.interface.js';

/** Timer handle of one pending copy-feedback reset. */
type CopyTimerHandle = ReturnType<typeof setTimeout>;

/**
 * One row of the log panel.
 *
 * Props-driven as before (the timestamp comes from the injected
 * `formatTimestamp`, the severity is rendered as a glyph **and** as text), plus
 * one purely local interaction: the row can be expanded to a key–value list of
 * its `details` (AIS-153).
 *
 * **Why the open state is local** (AIS-153 decision D-C): it is the fourth tier
 * of the state decision order — the interaction of a single component. It must
 * not survive a reload or be linkable (so not the URL), it does not come from
 * the server (so not TanStack Query), and no second part of the page shares it
 * (so not a store). One `useState` per row gives "any number of rows open at
 * once, all closed by default" for free, and a row that leaves the filtered list
 * and comes back is simply closed again — documented, not a bug.
 *
 * **Why the header is a button and not `<details>`** (decision D-B): `<summary>`
 * cannot be styled consistently with the token recipes across browsers, and the
 * copy controls inside the region would get an unpredictable focus order. A real
 * `<button aria-expanded aria-controls>` plus a `role="region"` region is the
 * same contract, fully selectable and testable.
 *
 * The header button wraps **only** the header band — glyph, level, timestamp,
 * chevron. The message and the one-line `detail` stay outside it, so a long
 * sentence never becomes the inside of a pressable button. The collapsed row
 * therefore looks exactly like it did before (decision D-D).
 *
 * @param props - see {@link LogEntryRowProps}.
 */
export function LogEntryRow({ entry, formatTimestamp }: LogEntryRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState<LogEntryCopyFlags>(LOG_ENTRY_COPY_IDLE);

  /**
   * Which detail values are expanded to pretty-printed JSON (AIS-163).
   *
   * A `Set` of stable field keys, so any number of values can be open at once
   * and each one toggles independently. Local for the same reason the row's own
   * open state is local: it is the fourth tier of the state decision order, it
   * is not server data and nothing else on the page needs it.
   */
  const [expandedJson, setExpandedJson] =
    useState<ReadonlySet<string>>(NO_EXPANDED_JSON);

  /**
   * One pending reset timer per copy control (AIS-153 decision A0).
   *
   * A `useRef` map rather than state: the handles are not rendered, and a
   * state write on every copy would re-render the row for no visual change. The
   * map also lets the cleanup below clear them all on unmount, so a reset can
   * never `setState` on a removed row.
   */
  const copyTimers = useRef<Map<LogEntryCopyTarget, CopyTimerHandle>>(
    new Map(),
  );

  const instanceId = useId();
  const regionId = `${instanceId}${LOG_ENTRY_DETAILS_REGION_ID_SUFFIX}`;
  const emptyId = `${instanceId}${LOG_ENTRY_DETAILS_EMPTY_ID_SUFFIX}`;

  const details = entry.details ?? [];
  const hasDetails = details.length > 0;
  const requestIdField = findRequestIdField(entry.details);

  useEffect(() => {
    const timers = copyTimers.current;

    return () => {
      timers.forEach((handle) => clearTimeout(handle));
      timers.clear();
    };
  }, []);

  /**
   * Expands or collapses one detail value's pretty-printed JSON (AIS-163).
   *
   * Writing a **new** set (never mutating the shared empty one) is what makes
   * the two JSON values of a row independent: closing one never touches the
   * other.
   *
   * @param fieldKey - stable key of the field inside this row.
   */
  function toggleJsonField(fieldKey: string): void {
    setExpandedJson((current) => {
      const next = new Set(current);

      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }

      return next;
    });
  }

  /**
   * Opens or closes the row, dropping the JSON expansions when it closes.
   *
   * The expansions belong to the region, so keeping them across a close would
   * greet the user with a half-expanded row on the next open.
   */
  function handleToggleRow(): void {
    if (isOpen) {
      setExpandedJson(NO_EXPANDED_JSON);
    }

    setIsOpen(!isOpen);
  }

  /**
   * Copies one piece of the entry and confirms it **on that control only**.
   *
   * A failed copy (no clipboard API, permission denied) leaves both labels in
   * their action state — `copyText` already swallowed the reason, so there is
   * nothing left to catch here.
   *
   * @param target - which control was pressed.
   * @param text - the exact text to copy.
   */
  async function handleCopy(
    target: LogEntryCopyTarget,
    text: string,
  ): Promise<void> {
    if (!(await copyText(text))) {
      return;
    }

    const pending = copyTimers.current.get(target);

    if (pending !== undefined) {
      clearTimeout(pending);
    }

    const handle = setTimeout(() => {
      copyTimers.current.delete(target);
      setCopied((current) => ({ ...current, [target]: false }));
    }, LOG_ENTRY_COPY_FEEDBACK_MS);

    copyTimers.current.set(target, handle);
    setCopied((current) => ({ ...current, [target]: true }));
  }

  return (
    <div
      className={cn(logEntryRowVariants({ level: entry.level }))}
      data-level={entry.level}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={regionId}
        aria-label={toEntryToggleLabel(isOpen, details.length)}
        className={cn(logEntryToggleVariants({ isOpen }))}
        onClick={handleToggleRow}
      >
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
        <ChevronDownIcon className={cn(logEntryChevronVariants({ isOpen }))} />
      </button>

      <p className="break-words">{entry.message}</p>

      {entry.detail ? (
        <p className="break-words text-xs text-text-secondary">
          {entry.detail}
        </p>
      ) : null}

      <div
        id={regionId}
        role="region"
        aria-label={LOG_ENTRY_DETAILS_REGION_LABEL}
        aria-describedby={hasDetails ? undefined : emptyId}
        hidden={!isOpen}
        className={cn(logEntryDetailsVariants())}
      >
        {hasDetails ? (
          <dl className="flex flex-col gap-2">
            {details.map((field, index) => {
              const fieldKey = `${field.label}-${index}`;
              const prettyJson = toPrettyJson(field.value);
              const isJsonExpanded = expandedJson.has(fieldKey);
              const jsonRegionId = `${instanceId}${LOG_DETAIL_JSON_REGION_ID_SUFFIX}-${index}`;

              return (
                <div key={fieldKey} className="flex flex-col">
                  <dt className={cn(logDetailFieldVariants({ slot: 'label' }))}>
                    {field.label}
                  </dt>
                  <dd
                    className={cn(
                      logDetailFieldVariants({
                        slot: 'value',
                        mono: field.mono === true,
                      }),
                    )}
                  >
                    <span data-log-detail-value className="block break-words">
                      {field.value}
                    </span>
                    {prettyJson === null ? null : (
                      <>
                        <button
                          type="button"
                          aria-expanded={isJsonExpanded}
                          aria-controls={jsonRegionId}
                          className={cn(logDetailJsonToggleVariants())}
                          onClick={() => toggleJsonField(fieldKey)}
                        >
                          {isJsonExpanded
                            ? LOG_DETAIL_JSON_TOGGLE_LABEL_CLOSE
                            : LOG_DETAIL_JSON_TOGGLE_LABEL_OPEN}
                        </button>
                        <pre
                          id={jsonRegionId}
                          hidden={!isJsonExpanded}
                          className={cn(logDetailJsonPreVariants())}
                        >
                          {prettyJson}
                        </pre>
                      </>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p id={emptyId} className="text-xs text-text-muted">
            {LOG_ENTRY_DETAILS_EMPTY_LABEL}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1">
          {requestIdField === null ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleCopy('requestId', requestIdField.value);
              }}
            >
              {copied.requestId
                ? LOG_ENTRY_COPY_DONE_LABEL
                : LOG_ENTRY_COPY_REQUEST_ID_LABEL}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void handleCopy('json', toEntryJson(entry));
            }}
          >
            {copied.json
              ? LOG_ENTRY_COPY_DONE_LABEL
              : LOG_ENTRY_COPY_ENTRY_LABEL}
          </Button>
        </div>
      </div>
    </div>
  );
}
