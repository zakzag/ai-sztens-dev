import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useEntityDialog } from './use-entity-dialog.js';

/**
 * Behaviour of the shared close handler (AIS-155 `D7`).
 *
 * The hook is exercised through a real `MemoryRouter` because its whole job is
 * router navigation; the dialog itself is irrelevant here, so the harness only
 * renders a button that closes and the current pathname.
 */

/** List route the overlay must return to. */
const LIST_PATH = '/api-keys';

/** Overlay route the harness starts on. */
const OVERLAY_PATH = '/api-keys/new';

/**
 * Renders a page that owns the close handler of an overlay.
 *
 * @returns the close button plus the marker of the current pathname.
 */
function CloseHarness() {
  const { closeDialog } = useEntityDialog(LIST_PATH);
  const { pathname } = useLocation();

  return (
    <div>
      <p>path:{pathname}</p>
      <button type="button" onClick={closeDialog}>
        Bezárás
      </button>
    </div>
  );
}

/**
 * Renders the harness at a given URL.
 *
 * @param path - the initial URL of the memory history.
 * @returns the render result.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<CloseHarness />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('useEntityDialog', () => {
  it('navigates from the overlay URL back to the list', async () => {
    const user = userEvent.setup();
    renderAt(OVERLAY_PATH);

    expect(screen.getByText(`path:${OVERLAY_PATH}`)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bezárás' }));

    expect(screen.getByText(`path:${LIST_PATH}`)).toBeInTheDocument();
  });

  it('closes to the list even when the overlay was opened as a deep link', async () => {
    const user = userEvent.setup();
    renderAt('/api-keys/abc123/view');

    await user.click(screen.getByRole('button', { name: 'Bezárás' }));

    expect(screen.getByText(`path:${LIST_PATH}`)).toBeInTheDocument();
  });

  it('does not leave the closed overlay in the history', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={[LIST_PATH, OVERLAY_PATH]} initialIndex={1}>
        <Routes>
          <Route path="*" element={<CloseHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Bezárás' }));

    // `replace` means the entry count is unchanged: after closing there is no
    // extra history entry that would re-open the dialog on "back".
    expect(screen.getByText(`path:${LIST_PATH}`)).toBeInTheDocument();
    expect(container.textContent).not.toContain(OVERLAY_PATH);
  });
});
