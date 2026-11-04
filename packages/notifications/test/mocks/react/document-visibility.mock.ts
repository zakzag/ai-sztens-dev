/**
 * Overrides `document.hidden`.
 *
 * jsdom reports a always-visible document, so the tab-hidden branch of the toast
 * timers can only be reached by shadowing the getter on the instance. The
 * property stays configurable, so a later call can flip it back.
 *
 * @param hidden - whether the document should report itself as hidden.
 */
export function setDocumentHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
}

/** Dispatches the event a real browser fires when the tab becomes hidden/visible. */
export function dispatchVisibilityChange(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}
