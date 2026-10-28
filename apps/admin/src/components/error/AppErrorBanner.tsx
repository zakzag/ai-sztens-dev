import { Banner, Button } from '@callback/ui';
import { useAppErrorBanner } from '../../features/error-surface/use-app-error-banner.js';
import type { AppErrorBannerProps } from './app-error-banner.interface.js';

/**
 * App-level banner of the layout shell (plan `D11`, tier 3).
 *
 * Expresses a *persistent condition* — offline, expired session, maintenance —
 * that belongs to no single page and must survive navigation. All decisions are
 * made outside this component: the hook derives the model from the query cache
 * and the browser's connectivity, the pure classifier picks the condition, and
 * here only the model is mapped to a `Banner`.
 *
 * It is deliberately not modal and never navigates on its own: the session CTA
 * calls the injected {@link AppErrorBannerProps.onLogin}, so the user, not the
 * error, triggers the transition.
 *
 * @param props - see {@link AppErrorBannerProps}.
 * @returns the banner, or `null` when no condition is active.
 */
export function AppErrorBanner({ onLogin }: AppErrorBannerProps) {
  const { model, dismiss } = useAppErrorBanner();

  if (model === null) {
    return null;
  }

  return (
    <Banner
      variant={model.variant}
      title={model.title}
      onDismiss={dismiss}
      dismissLabel={model.dismissLabel}
      action={
        model.actionLabel === null ? undefined : (
          <Button type="button" variant="secondary" size="sm" onClick={onLogin}>
            {model.actionLabel}
          </Button>
        )
      }
    >
      {model.message}
    </Banner>
  );
}
