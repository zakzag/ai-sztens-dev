import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DIALOG_CLOSE_LABEL } from '../src/components/dialog/dialog.const.js';
import { EntityDialog } from '../src/components/entity-dialog/EntityDialog.js';
import type { EntityDialogProps } from '../src/components/entity-dialog/entity-dialog.interface.js';
import { createOverlayUser } from './mocks/overlay-user.mock.js';

/** Title every case renders — the accessible name of the window. */
const TITLE = 'Új API kulcs';

/** Subtitle every case renders. */
const DESCRIPTION = 'A kulcs értéke a mentés után nem jelenik meg újra.';

/** Body content of the overlay. */
const BODY = 'Az űrlap mezői a törzsben vannak.';

/** Submit button label. */
const SUBMIT_LABEL = 'Létrehozás';

/** Label of the secondary footer action. */
const FOOTER_EXTRA_LABEL = 'Kulcs törlése';

/** Id of the form the footer submit button belongs to. */
const FORM_ID = 'entity-form';

/** Props of the local harness. */
interface HarnessProps {
  readonly onClose: () => void;
  readonly submit?: EntityDialogProps['submit'];
  readonly headerStart?: EntityDialogProps['headerStart'];
  readonly headerEnd?: EntityDialogProps['headerEnd'];
  readonly footerExtras?: EntityDialogProps['footerExtras'];
}

/**
 * Renders the always-open overlay.
 *
 * `EntityDialog` has no `open` prop on purpose (the route owns visibility), so
 * a test renders it directly instead of driving a controlled trigger.
 *
 * @param props - the `onClose` spy plus the slots under test.
 * @returns the rendered overlay.
 */
function renderEntityDialog({
  onClose,
  submit = { label: SUBMIT_LABEL, formId: FORM_ID },
  headerStart,
  headerEnd,
  footerExtras,
}: HarnessProps) {
  return render(
    <EntityDialog
      title={TITLE}
      description={DESCRIPTION}
      onClose={onClose}
      submit={submit}
      headerStart={headerStart}
      headerEnd={headerEnd}
      footerExtras={footerExtras}
    >
      <p>{BODY}</p>
    </EntityDialog>,
  );
}

describe('EntityDialog', () => {
  it('renders an aria-modal dialog named by its title, with subtitle and body', () => {
    renderEntityDialog({ onClose: vi.fn() });

    const dialog = screen.getByRole('dialog', { name: TITLE });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByText(BODY)).toBeInTheDocument();
  });

  it('renders a footer submit button bound to the form by id', () => {
    renderEntityDialog({ onClose: vi.fn() });

    const submit = screen.getByRole('button', { name: SUBMIT_LABEL });

    expect(submit).toHaveAttribute('type', 'submit');
    expect(submit).toHaveAttribute('form', FORM_ID);
    expect(screen.getByRole('button', { name: 'Mégsem' })).toHaveAttribute(
      'type',
      'button',
    );
  });

  it('renders no submit button in read-only mode', () => {
    renderEntityDialog({ onClose: vi.fn(), submit: null });

    expect(
      screen.queryByRole('button', { name: SUBMIT_LABEL }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mégsem' })).toBeInTheDocument();
  });

  it('swaps the submit label for the pending one and disables both buttons', () => {
    renderEntityDialog({
      onClose: vi.fn(),
      submit: {
        label: SUBMIT_LABEL,
        formId: FORM_ID,
        pendingLabel: 'Mentés…',
        isSubmitting: true,
      },
    });

    const submit = screen.getByRole('button', { name: 'Mentés…' });

    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Mégsem' })).toBeDisabled();
  });

  it('renders the header slots and keeps the close control last in the header', () => {
    renderEntityDialog({
      onClose: vi.fn(),
      headerStart: <button type="button">Bal</button>,
      headerEnd: <button type="button">Jobb</button>,
    });

    const dialog = screen.getByRole('dialog', { name: TITLE });
    const header = dialog.firstElementChild;
    const headerButtons = Array.from(header?.querySelectorAll('button') ?? []);
    const close = screen.getByRole('button', { name: DIALOG_CLOSE_LABEL });

    expect(screen.getByRole('button', { name: 'Bal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jobb' })).toBeInTheDocument();
    expect(headerButtons).toHaveLength(3);
    expect(headerButtons.at(-1)).toBe(close);
  });

  it('renders the footer extras next to the action pair', () => {
    renderEntityDialog({
      onClose: vi.fn(),
      footerExtras: <button type="button">{FOOTER_EXTRA_LABEL}</button>,
    });

    expect(
      screen.getByRole('button', { name: FOOTER_EXTRA_LABEL }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SUBMIT_LABEL })).toBeInTheDocument();
  });

  it('sizes the panel to its content and makes the body the scroll container', () => {
    renderEntityDialog({ onClose: vi.fn() });

    const dialog = screen.getByRole('dialog', { name: TITLE });
    const body = screen.getByText(BODY).parentElement;

    expect(dialog.className).toContain('w-auto');
    expect(dialog.className).toContain('max-h-[calc(100vh-4rem)]');
    expect(body?.className).toContain('overflow-y-auto');
  });

  it('calls onClose from the header close control', async () => {
    const onClose = vi.fn();
    const user = createOverlayUser();
    renderEntityDialog({ onClose });

    await user.click(screen.getByRole('button', { name: DIALOG_CLOSE_LABEL }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    const user = createOverlayUser();
    renderEntityDialog({ onClose });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose from the dismiss button', async () => {
    const onClose = vi.fn();
    const user = createOverlayUser();
    renderEntityDialog({ onClose });

    await user.click(screen.getByRole('button', { name: 'Mégsem' }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
