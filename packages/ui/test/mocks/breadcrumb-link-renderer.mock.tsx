import { vi } from 'vitest';
import type {
  BreadcrumbLinkRenderer,
  BreadcrumbLinkRendererProps,
} from '../../src/components/breadcrumb/breadcrumb.interface.js';

/**
 * Test id of the element the injected renderer produces.
 *
 * The suite uses it to prove that the renderer's output — and not the internal
 * `<a href>` fallback — ends up in the DOM.
 */
export const BREADCRUMB_MOCK_LINK_TEST_ID = 'breadcrumb-mock-link';

/**
 * Contract of {@link createBreadcrumbLinkRendererMock}.
 */
export interface BreadcrumbLinkRendererMock {
  /** Pass this to `<Breadcrumb renderLink={…} />`. */
  readonly renderLink: BreadcrumbLinkRenderer;
  /** Every call the component made, in order. */
  readonly calls: readonly BreadcrumbLinkRendererProps[];
}

/**
 * Builds an injected link renderer that records its calls.
 *
 * The mock lives here (not in the test file) because the repo rule puts every
 * stub under `test/mocks`.
 *
 * @returns the renderer to pass to the component plus its recorded calls.
 */
export function createBreadcrumbLinkRendererMock(): BreadcrumbLinkRendererMock {
  const calls: BreadcrumbLinkRendererProps[] = [];

  const renderLink = vi.fn((props: BreadcrumbLinkRendererProps) => {
    calls.push(props);

    return (
      <a data-testid={BREADCRUMB_MOCK_LINK_TEST_ID} href={props.to}>
        {props.children}
      </a>
    );
  }) satisfies BreadcrumbLinkRenderer;

  return { renderLink, calls };
}
