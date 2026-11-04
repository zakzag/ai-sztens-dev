import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  OVERLAY_TOOLTIP_CONTENT,
  OVERLAY_TOOLTIP_TRIGGER_LABEL,
  TooltipHarness,
} from './mocks/overlay-harness.mock.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/**
 * Tests of `Tooltip`.
 *
 * The important assertion is the negative one (AIS-117 D7): the tooltip is a
 * *description*, never the accessible name of its trigger.
 */
describe('Tooltip', () => {
  it('renders no panel before interaction', () => {
    render(<TooltipHarness />);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows its content on focus and links it as a description', async () => {
    const user = createOverlayUser();
    render(<TooltipHarness />);

    const trigger = screen.getByRole('button', {
      name: OVERLAY_TOOLTIP_TRIGGER_LABEL,
    });

    await user.tab();

    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip).toHaveTextContent(OVERLAY_TOOLTIP_CONTENT);
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(trigger).toHaveAccessibleName(OVERLAY_TOOLTIP_TRIGGER_LABEL);
  });

  it('shows its content on hover', async () => {
    const user = createOverlayUser();
    render(<TooltipHarness />);

    await user.hover(
      screen.getByRole('button', { name: OVERLAY_TOOLTIP_TRIGGER_LABEL }),
    );

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      OVERLAY_TOOLTIP_CONTENT,
    );
  });

  it('never opens while disabled', async () => {
    const user = createOverlayUser();
    render(<TooltipHarness disabled />);

    const trigger = screen.getByRole('button', {
      name: OVERLAY_TOOLTIP_TRIGGER_LABEL,
    });

    await user.tab();
    await user.hover(trigger);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-describedby');
  });
});
