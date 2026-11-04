import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LogEntryRow } from '../src/components/log-drawer/LogEntryRow.js';
import { LOG_LEVEL_LABELS } from '../src/components/log-drawer/log-drawer.const.js';
import {
  LOG_ENTRY_BASE_TIMESTAMP,
  buildLogEntry,
  stubFormatTimestamp,
} from './mocks/log-entries.mock.js';

describe('LogEntryRow', () => {
  it('renders the message and the level as text', () => {
    render(
      <LogEntryRow
        entry={buildLogEntry({ level: 'warning', message: 'Lassú kérés' })}
        formatTimestamp={stubFormatTimestamp}
      />,
    );

    expect(screen.getByText('Lassú kérés')).toBeInTheDocument();
    expect(
      screen.getByText(LOG_LEVEL_LABELS.warning),
    ).toBeInTheDocument();
  });

  it('marks the row with its level for the accent recipe', () => {
    const { container } = render(
      <LogEntryRow
        entry={buildLogEntry({ level: 'system' })}
        formatTimestamp={stubFormatTimestamp}
      />,
    );

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
    render(
      <LogEntryRow
        entry={buildLogEntry({ detail: 'POST /api/v1/keys → 500' })}
        formatTimestamp={stubFormatTimestamp}
      />,
    );

    expect(
      screen.getByText('POST /api/v1/keys → 500'),
    ).toBeInTheDocument();
  });

  it('renders no detail element when the entry has none', () => {
    const { container } = render(
      <LogEntryRow
        entry={buildLogEntry()}
        formatTimestamp={stubFormatTimestamp}
      />,
    );

    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
