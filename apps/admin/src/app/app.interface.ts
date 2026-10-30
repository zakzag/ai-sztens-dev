import type { QueryClient } from '@tanstack/react-query';

/** Props of the root {@link App} component. */
export interface AppProps {
  /**
   * The query client, created in `main.tsx`. It is handed down instead of being
   * instantiated inside the provider chain, because the notification store
   * (AIS-84) has to bind its cache callbacks to this very instance.
   */
  readonly queryClient: QueryClient;
}
