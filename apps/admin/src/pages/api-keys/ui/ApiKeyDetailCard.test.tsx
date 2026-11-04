/**
 * Tests of the read-only detail card (AIS-131).
 *
 * The component is props-driven, so every state is one `render` away. The two
 * interesting assertions are negative: the token must not appear in the DOM, and
 * the delete **button** must only report the request (the mutation lives in the
 * page). The view model comes from the real mapper, so a formatting change
 * breaks this suite instead of silently rendering something else.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FILLED_API_KEY, SECOND_API_KEY } from '@callback/shared';
import { EXPIRY_ACTIVE_LABEL, EXPIRY_NONE_LABEL } from '../../../entities/api-key/api-key.const.js';
import { toApiKeyDetailViewModel } from '../../../entities/api-key/api-key.mapper.js';
import {
  API_KEY_DELETE_LABEL,
  API_KEY_DETAIL_FIELD_LABELS,
} from '../api-keys.const.js';
import type { ApiKeyDetailCardProps } from '../api-keys.interface.js';
import { ApiKeyDetailCard } from './ApiKeyDetailCard.js';

/** Fixed clock so the expiry verdict never depends on the real date. */
const NOW = Date.parse('2026-11-04T12:00:00.000Z');

/**
 * @param overrides - props that differ from the defaults.
 * @returns the render result.
 */
function renderCard(overrides: Partial<ApiKeyDetailCardProps> = {}) {
  return render(
    <ApiKeyDetailCard
      viewModel={toApiKeyDetailViewModel(FILLED_API_KEY, NOW)}
      onRequestDelete={() => undefined}
      isDeleting={false}
      {...overrides}
    />,
  );
}

describe('ApiKeyDetailCard', () => {
  it('renders every field of the row', () => {
    renderCard();

    expect(
      screen.getByText(FILLED_API_KEY.identifier),
    ).toBeInTheDocument();
    expect(screen.getByText(FILLED_API_KEY.description ?? '')).toBeInTheDocument();
    expect(
      screen.getByText(API_KEY_DETAIL_FIELD_LABELS.createdAt),
    ).toBeInTheDocument();
    expect(
      screen.getByText(API_KEY_DETAIL_FIELD_LABELS.updatedAt),
    ).toBeInTheDocument();
  });

  it('renders the expiry verdict as a status badge', () => {
    renderCard();

    const badge = screen.getByText(EXPIRY_ACTIVE_LABEL, {
      selector: '[data-status]',
    });

    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('data-status', 'active');
  });

  it('renders the no-expiry verdict for a key without expiry', () => {
    renderCard({ viewModel: toApiKeyDetailViewModel(SECOND_API_KEY, NOW) });

    // The "no expiry" sentence appears twice by design: once as the badge label
    // and once as the `expiresAt` value of the description list. The selector
    // pins the assertion to the badge, not to whichever node comes first.
    const badge = screen.getByText(EXPIRY_NONE_LABEL, {
      selector: '[data-status]',
    });

    expect(badge).toHaveAttribute('data-status', 'none');
    expect(screen.getAllByText(EXPIRY_NONE_LABEL)).toHaveLength(2);
  });

  it('reports the delete request instead of performing it', async () => {
    const onRequestDelete = vi.fn();
    renderCard({ onRequestDelete });

    await userEvent.click(
      screen.getByRole('button', { name: API_KEY_DELETE_LABEL }),
    );

    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });

  it('disables the delete button while a delete is in flight', () => {
    renderCard({ isDeleting: true });

    expect(
      screen.getByRole('button', { name: API_KEY_DELETE_LABEL }),
    ).toBeDisabled();
  });

  it('never renders the apiKey token value', () => {
    const { container } = renderCard();

    expect(container.textContent).not.toContain(FILLED_API_KEY.apiKey);
  });
});
