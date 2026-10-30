import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/** Props of {@link AppProviders}. */
export interface AppProvidersProps {
  /**
   * The query client. It is **created in `main.tsx`** and handed down, so the
   * `QueryClientProvider` stays the root of the React tree while the provider
   * chain itself lives in the `app/` layer.
   */
  readonly queryClient: QueryClient;

  /** The application tree. */
  readonly children: ReactNode;
}
