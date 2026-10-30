/**
 * App-level banner state (plan `D11`, tier 3).
 *
 * There is no banner store: the condition is *derived* on every render from
 *  1. `navigator.onLine` (via {@link useOnlineStatus}),
 *  2. every error currently in the TanStack Query cache,
 *  3. one piece of page UI state — whether the user closed the current condition.
 * Point 3 is `useState`, because it is view state, not server data.
 *
 * The classification itself is pure ({@link toBannerCondition},
 * {@link toBannerModel}), so this hook is only the wiring.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type {
  AppErrorBannerResult,
  BannerCondition,
} from '../../lib/error-surface.interface.js';
import {
  toBannerCondition,
  toBannerModel,
} from '../../lib/error-surface.logic.js';
import { createQueryErrorStore } from './query-error.store.js';
import { useOnlineStatus } from './use-online-status.js';

/**
 * @returns the banner to render (or `null`) and the dismiss action.
 */
export function useAppErrorBanner(): AppErrorBannerResult {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  // One store per mounted hook instance; rebuilt only if the client changes,
  // which in this app never happens (the client is created once in `main.tsx`).
  const [errorStore] = useState(() => createQueryErrorStore(queryClient));

  const errors = useSyncExternalStore(
    errorStore.subscribe,
    errorStore.getErrors,
    errorStore.getErrors,
  );

  const condition = toBannerCondition(isOnline, errors);
  const [dismissedCondition, setDismissedCondition] =
    useState<BannerCondition | null>(null);

  useEffect(() => () => errorStore.dispose(), [errorStore]);

  // A changed set of failures invalidates the dismissal: the user closed *that*
  // condition, not every future one. (`getErrors` keeps its identity while the
  // cache is unchanged, so this does not fire on ordinary re-renders.)
  useEffect(() => {
    setDismissedCondition(null);
  }, [errors]);

  const dismiss = useCallback(() => {
    setDismissedCondition(condition);
  }, [condition]);

  const model =
    condition !== null && condition !== dismissedCondition
      ? toBannerModel(condition)
      : null;

  return { model, dismiss };
}
