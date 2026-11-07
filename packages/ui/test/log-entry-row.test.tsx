import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogEntryRow } from '../src/components/log-drawer/LogEntryRow.js';
import {
  LOG_ENTRY_COPY_DONE_LABEL,
  LOG_ENTRY_COPY_ENTRY_LABEL,
  LOG_ENTRY_COPY_FEEDBACK_MS,
  LOG_ENTRY_COPY_REQUEST_ID_LABEL,
  LOG_ENTRY_DETAILS_EMPTY_LABEL,
  LOG_ENTRY_DETAILS_REGION_LABEL,
  LOG_LEVEL_LABELS,
} from '../src/components/log-drawer/log-drawer.const.js';
import { toEntryToggleLabel } from '../src/components/log-drawer/log-drawer.logic.js';
import type { LogEntryItem } from '../src/components/log-drawer/log-drawer.interface.js';
import {
  LOG_ENTRY_BASE_TIMESTAMP,
  LOG_ENTRY_REQUEST_ID_VALUE,
  buildLogDetailField,
  buildLogDetails,
  buildLogEntry,
  stubFormatTimestamp,
} from './mocks/log-entries.mock.js';
import { stubClipboard, stubClipboardMissing } from './mocks/clipboard.mock.js';

/**
 * Renders one row with the default error entry.
 *
 * @param overrides - fields to replace on the fixture.
 * @returns the render result, so a test can inspect the container.
 */
function renderRow(overrides: Partial<LogEntryItem> = {}) {
  return render(
    <LogEntryRow
      entry={buildLogEntry(overrides)}
      formatTimestamp={stubFormatTimestamp}
    />,
  );
}

/**
 * @param isOpen - row state the accessible name is built from.
 * @param detailCount - number of facts the fixture carries.
 * @returns the header toggle button of the row.
 */
function getToggle(isOpen: boolean, detailCount = 0): HTMLElement {
  return screen.getByRole('button', {
    name: toEntryToggleLabel(isOpen, detailCount),
  });
}

/**
 * @returns the detail region of the rendered row, collapsed or not.
 *
 * Queried through the DOM instead of `getByRole`, because a `hidden` region has
 * **no accessible name**: the accname algorithm returns the empty string for a
 * node outside the accessibility tree, so `name: …` can never match while the
 * row is collapsed. The role itself is asserted separately on the same element.
 */
function getRegion(): HTMLElement {
  const region = document.querySelector<HTMLElement>('[role="region"]');

  if (region === null) {
    throw new Error('The row rendered no detail region.');
  }

  return region;
}

/**
 * Opens the row of a single-row render.
 *
 * Synchronous on purpose: a `findBy*`/`waitFor` query would depend on real
 * timers, which the feedback tests replace with fake ones.
 *
 * @param detailCount - number of facts the fixture carries.
 */
async function openRow(detailCount = 3): Promise<void> {
  fireEvent.click(getToggle(false, detailCount));
}

/**
 * Lets the awaited clipboard promise settle, so the feedback flag is applied.
 *
 * `handleCopy` awaits `copyText` before touching state, so a click alone is not
 * enough under fake timers — the microtask queue has to be drained inside `act`.
 */
async function flushCopy(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('LogEntryRow', () => {
  it('renders the message and the level as text', () => {
    renderRow({ level: 'warning', message: 'Lassú kérés' });

    expect(screen.getByText('Lassú kérés')).toBeInTheDocument();
    expect(screen.getByText(LOG_LEVEL_LABELS.warning)).toBeInTheDocument();
  });

  it('marks the row with its level for the accent recipe', () => {
    const { container } = renderRow({ level: 'system' });

    expect(container.firstElementChild).toHaveAttribute('data-level', 'system');
  });

  it('formats the timestamp through the injected formatter', () => {
    const formatTimestamp = vi.fn(stubFormatTimestamp);

    render(
      <LogEntryRow
        entry={buildLogEntry({ createdAt: LOG_ENTRY_BASE_TIMESTAMP })}
        formatTimestamp={formatTimestamp}
      />,
    );

    expect(formatTimestamp).toHaveBeenCalledTimes(1);
    expect(formatTimestamp).toHaveBeenCalledWith(LOG_ENTRY_BASE_TIMESTAMP);
    expect(
      screen.getByText(stubFormatTimestamp(LOG_ENTRY_BASE_TIMESTAMP)),
    ).toBeInTheDocument();
  });

  it('renders the detail when the entry has one', () => {
    renderRow({ detail: 'POST /api/v1/keys → 500' });

    expect(screen.getByText('POST /api/v1/keys → 500')).toBeInTheDocument();
  });

  it('renders no visible detail paragraph when the entry has none', () => {
    const { container } = renderRow();

    const visibleParagraphs = Array.from(
      container.querySelectorAll('p'),
    ).filter((paragraph) => paragraph.closest('[hidden]') === null);

    expect(visibleParagraphs).toHaveLength(1);
  });
});

describe('LogEntryRow — expandable details', () => {
  it('starts collapsed and wires the toggle to the region', () => {
    renderRow({ details: buildLogDetails() });

    const toggle = getToggle(false, 3);
    const region = getRegion();

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', region.id);
    expect(region).toHaveAttribute('role', 'region');
    expect(region).toHaveAttribute(
      'aria-label',
      LOG_ENTRY_DETAILS_REGION_LABEL,
    );
    expect(region).toHaveAttribute('hidden');
  });

  it('expands on click and lists the facts in their original order', () => {
    const { container } = renderRow({ details: buildLogDetails() });

    fireEvent.click(getToggle(false, 3));

    expect(getToggle(true, 3)).toHaveAttribute('aria-expanded', 'true');

    const terms = Array.from(container.querySelectorAll('dt')).map(
      (term) => term.textContent,
    );
    const values = Array.from(container.querySelectorAll('dd')).map(
      (value) => value.textContent,
    );

    expect(terms).toEqual(buildLogDetails().map((field) => field.label));
    expect(values).toEqual(buildLogDetails().map((field) => field.value));
  });

  it('collapses on a second click', () => {
    renderRow({ details: buildLogDetails() });

    fireEvent.click(getToggle(false, 3));
    fireEvent.click(getToggle(true, 3));

    expect(getToggle(false, 3)).toHaveAttribute('aria-expanded', 'false');
    expect(getRegion()).toHaveAttribute('hidden');
  });

  it('expands with the keyboard', async () => {
    renderRow({ details: buildLogDetails() });

    const toggle = getToggle(false, 3);
    toggle.focus();
    await userEvent.keyboard('{Enter}');

    expect(getToggle(true, 3)).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps two rows open at the same time', () => {
    render(
      <>
        <LogEntryRow
          entry={buildLogEntry({
            id: 'a',
            message: 'A',
            details: buildLogDetails(),
          })}
          formatTimestamp={stubFormatTimestamp}
        />
        <LogEntryRow
          entry={buildLogEntry({
            id: 'b',
            message: 'B',
            details: buildLogDetails(),
          })}
          formatTimestamp={stubFormatTimestamp}
        />
      </>,
    );

    screen
      .getAllByRole('button', { name: toEntryToggleLabel(false, 3) })
      .forEach((toggle) => fireEvent.click(toggle));

    expect(
      screen.getAllByRole('region', { name: LOG_ENTRY_DETAILS_REGION_LABEL }),
    ).toHaveLength(2);
  });

  it('states that there is no data when the entry has no details', async () => {
    renderRow();

    await openRow(0);

    expect(screen.getByText(LOG_ENTRY_DETAILS_EMPTY_LABEL)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    ).not.toBeInTheDocument();
  });

  it('renders a mono value in the monospace recipe only', async () => {
    const { container } = renderRow({
      details: [
        buildLogDetailField({ label: 'requestId', value: 'req-1', mono: true }),
        buildLogDetailField({ label: 'url', value: 'POST /api/v1/keys' }),
      ],
    });

    await openRow(2);

    const values = Array.from(container.querySelectorAll('dd'));

    expect(values[0]?.className).toContain('font-mono');
    expect(values[1]?.className).not.toContain('font-mono');
  });

  it('includes the action and the fact count in the accessible name', () => {
    renderRow({ details: buildLogDetails() });

    const toggle = getToggle(false, 3);

    expect(toggle.getAttribute('aria-label')).toContain('megnyitása');
    expect(toggle.getAttribute('aria-label')).toContain('3');
  });
});

describe('LogEntryRow — copy controls', () => {
  it('copies the request id and confirms it on that button only', async () => {
    const clipboard = stubClipboard();
    renderRow({ details: buildLogDetails() });

    await openRow(3);
    fireEvent.click(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    );
    await flushCopy();

    expect(clipboard.writeText).toHaveBeenCalledWith(
      LOG_ENTRY_REQUEST_ID_VALUE,
    );
    expect(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_DONE_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_ENTRY_LABEL }),
    ).toBeInTheDocument();

    clipboard.restore();
  });

  it('copies the whole entry as JSON', async () => {
    const clipboard = stubClipboard();
    renderRow({ details: buildLogDetails() });

    await openRow(3);
    fireEvent.click(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_ENTRY_LABEL }),
    );
    await flushCopy();

    const copied = clipboard.writeText.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(copied) as Record<string, unknown>;

    expect(parsed['id']).toBe('log-1');
    expect(parsed['details']).toEqual(buildLogDetails());

    clipboard.restore();
  });

  it('resets the feedback label after the feedback window', async () => {
    vi.useFakeTimers();
    const clipboard = stubClipboard();
    renderRow({ details: buildLogDetails() });

    await openRow(3);
    fireEvent.click(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    );
    await flushCopy();

    expect(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_DONE_LABEL }),
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(LOG_ENTRY_COPY_FEEDBACK_MS);
    });

    expect(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    ).toBeInTheDocument();

    clipboard.restore();
  });

  it('keeps the two feedback timers independent', async () => {
    vi.useFakeTimers();
    const clipboard = stubClipboard();
    renderRow({ details: buildLogDetails() });

    await openRow(3);

    fireEvent.click(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    );
    await flushCopy();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    fireEvent.click(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_ENTRY_LABEL }),
    );
    await flushCopy();

    expect(
      screen.getAllByRole('button', { name: LOG_ENTRY_COPY_DONE_LABEL }),
    ).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(LOG_ENTRY_COPY_FEEDBACK_MS - 500);
    });

    expect(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_DONE_LABEL }),
    ).toBeInTheDocument();

    clipboard.restore();
  });

  it('stays silent when the clipboard rejects', async () => {
    const clipboard = stubClipboard({
      writeText: () => Promise.reject(new Error('permission denied')),
    });
    renderRow({ details: buildLogDetails() });

    await openRow(3);
    fireEvent.click(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    );
    await flushCopy();

    expect(
      screen.queryByRole('button', { name: LOG_ENTRY_COPY_DONE_LABEL }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_REQUEST_ID_LABEL }),
    ).toBeInTheDocument();

    clipboard.restore();
  });

  it('stays silent when the environment has no clipboard', async () => {
    const restore = stubClipboardMissing();
    renderRow({ details: buildLogDetails() });

    await openRow(3);
    fireEvent.click(
      screen.getByRole('button', { name: LOG_ENTRY_COPY_ENTRY_LABEL }),
    );
    await flushCopy();

    expect(
      screen.queryByRole('button', { name: LOG_ENTRY_COPY_DONE_LABEL }),
    ).not.toBeInTheDocument();

    restore();
  });
});
