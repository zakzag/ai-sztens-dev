import type { ReactElement, ReactNode } from 'react';
import type { NotificationStore } from '../../../src/core/notification.interface.js';
import type { NotificationStorage } from '../../../src/core/notification.storage.interface.js';
import { NotificationProvider } from '../../../src/react/notification.context.js';
import type { LogDrawerWidthStorage } from '../../../src/react/notification-react.interface.js';

/** Everything a binding test may inject into the provider. */
export interface ProviderHarnessOptions {
  readonly store?: NotificationStore;
  readonly storage?: NotificationStorage;
  readonly widthStorage?: LogDrawerWidthStorage;
  readonly includeDetails?: boolean;
  readonly formatTimestamp?: (epochMs: number) => string;
}

/**
 * Builds a `renderHook`/`render` wrapper around the real provider.
 *
 * The provider is never replaced by a mock: the tests exercise the real context,
 * the real subscription and the real effects, and only the *collaborators* are
 * injected (store, mirror, formatter).
 *
 * @param options - collaborators to inject; omitted ones fall back to the
 *   provider's own defaults, which is itself worth testing.
 * @returns a wrapper component accepting `children`.
 */
export function createNotificationWrapper(
  options: ProviderHarnessOptions = {},
): ({ children }: { children: ReactNode }) => ReactElement {
  return function NotificationWrapper({
    children,
  }: {
    children: ReactNode;
  }): ReactElement {
    return (
      <NotificationProvider
        store={options.store}
        storage={options.storage}
        widthStorage={options.widthStorage}
        includeDetails={options.includeDetails}
        formatTimestamp={options.formatTimestamp}
      >
        {children}
      </NotificationProvider>
    );
  };
}
