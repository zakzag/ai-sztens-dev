/**
 * Thrown when a notification hook is used outside `<NotificationProvider>`.
 *
 * A typed error instead of a generic one, so a missing provider is immediately
 * obvious in a stack trace and can be asserted by name in a test (AIS-83 D2).
 */
export class MissingNotificationProviderError extends Error {
  /**
   * @param hookName - the hook that failed, e.g. `useToasts`.
   */
  constructor(hookName: string) {
    super(`[notifications] ${hookName} must be used inside <NotificationProvider>`);
    this.name = 'MissingNotificationProviderError';
  }
}
