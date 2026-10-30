import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BuildInfoFooter } from './BuildInfoFooter.js';

/**
 * Harness smoke test.
 *
 * It renders a real component (not a synthetic `expect(true)`) so the Vitest +
 * Testing Library + jest-dom chain is proven end to end: if the matchers, the
 * jsdom environment or the React plugin were misconfigured, this test fails.
 *
 * Local runs do not inject the build metadata, so the footer renders the `—`
 * placeholder — that is exactly the branch asserted here.
 */
describe('BuildInfoFooter', () => {
  it('renders the build info line with placeholders when nothing was injected', () => {
    render(<BuildInfoFooter />);

    const footer = screen.getByTestId('build-info');

    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent('Telepítve');
    expect(footer).toHaveTextContent('Verzió');
    expect(footer).toHaveTextContent('—');
  });
});
