import type { ReactElement } from 'react';
import { LogDrawer, ToastStack } from '@callback/ui';
import { useNotificationContext } from './notification.context.js';
import {
  useLogDrawer,
  useLogEntries,
  useToastTimers,
  useToasts,
} from './use-notifications.js';

/**
 * Renders the toast stack and the log drawer of the surrounding provider.
 *
 * The host is the only place that decides *policy* (AIS-83 D5–D9):
 *
 * - the toast lifetimes come from {@link useToastTimers};
 * - the drawer's open/filter/paging window and its width come from
 *   {@link useLogDrawer};
 * - the timestamp formatter comes from the provider, so `packages/ui` never has
 *   to own localisation.
 *
 * It never emits: every notification is produced by an emitter (a form, a query
 * callback, the HTTP layer, the global listeners of the provider). A host that
 * emitted on its own would make the log a self-referential echo.
 *
 * @returns the two presentational surfaces, or nothing visible while both are empty.
 */
export function NotificationHost(): ReactElement {
  const { store, formatTimestamp } = useNotificationContext('NotificationHost');
  const controller = useLogDrawer();
  const toasts = useToasts();
  const entries = useLogEntries(controller);
  const timers = useToastTimers(toasts);

  return (
    <>
      <ToastStack
        toasts={toasts}
        onDismiss={store.dismiss}
        onPause={timers.pause}
        onResume={timers.resume}
      />
      <LogDrawer
        entries={entries}
        isOpen={controller.isOpen}
        unseenCount={controller.unseenCount}
        levelFilter={controller.levelFilter}
        hasMore={controller.hasMore}
        onToggle={controller.toggle}
        onClose={controller.close}
        onFilterChange={controller.setLevelFilter}
        onLoadMore={controller.loadMore}
        onClear={controller.clear}
        formatTimestamp={formatTimestamp}
        width={controller.width}
        widthRange={controller.widthRange}
        isResizing={controller.isResizing}
        onWidthChange={controller.updateWidth}
        onResizeStart={controller.beginResize}
        onResizeEnd={controller.endResize}
        onWidthReset={controller.resetWidth}
      />
    </>
  );
}
