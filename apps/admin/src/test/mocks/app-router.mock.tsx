import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext.js';
import { SessionContext } from '../../app/providers/session-provider.js';
import type { SessionState } from '../../app/session/session.interface.js';

/**
 * Render helpers for the `app/` layer tests.
 *
 * The `app/` components read four contexts: the router, the session, the query
 * client (the app-level banner reads the query cache) and the auth provider
 * (the login page needs it). These wrappers supply them, so a component test
 * can focus on the component instead of rebuilding the whole provider chain.
 */

/** Props of {@link renderWithRouter}. */
export interface RenderWithRouterOptions extends Omit<
  RenderOptions,
  'wrapper'
> {
  /** The initial URL. */
  readonly initialEntries?: string[];

  /** The session state the components see. */
  readonly session?: SessionState;
}

/**
 * Renders a tree inside a memory router, a session context, an auth provider
 * and a query client.
 *
 * @param ui - the tree to render.
 * @param options - see {@link RenderWithRouterOptions}.
 * @returns the testing-library render result.
 */
export function renderWithRouter(
  ui: ReactElement,
  options: RenderWithRouterOptions = {},
): RenderResult {
  const {
    initialEntries = ['/'],
    session = createMockSession(),
    ...renderOptions
  } = options;
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <SessionContext.Provider value={session}>
              {children}
            </SessionContext.Provider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * An isolated query client for the tests.
 *
 * Retries are disabled: a retrying query would make an error-state test sit on
 * a timer and would hit the service double more than once.
 *
 * @returns the client.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * A session state for the tests.
 *
 * @param overrides - the fields to override.
 * @returns the session state.
 */
export function createMockSession(
  overrides: Partial<SessionState> = {},
): SessionState {
  return {
    isAuthenticated: true,
    logout: () => undefined,
    ...overrides,
  };
}
