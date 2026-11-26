/**
 * jsdom shims and the shared `userEvent` setup for the overlay primitives.
 *
 * Radix's `DropdownMenu` (the engine behind the `SelectMenu` primitive) calls
 * `ResizeObserver`, `IntersectionObserver`, pointer-capture and
 * `scrollIntoView`, none of which jsdom implements. The shims are installed on
 * import, so a test only has to import this module and every overlay assertion
 * starts from the same environment — patching inside a test file is forbidden
 * (mocks live in `src/test/mocks/`).
 *
 * The `userEvent` instance is created with `pointerEventsCheck: 0` because a
 * portalled overlay can end up under `pointer-events: none` on `body`, which
 * makes the library reject clicks with a false "unable to click element" error.
 */

import userEvent from '@testing-library/user-event';

/** Callback-agnostic `ResizeObserver` stand-in; Popper only needs the API. */
class ResizeObserverShim implements ResizeObserver {
  public observe(): void {}

  public unobserve(): void {}

  public disconnect(): void {}
}

/** `IntersectionObserver` stand-in; floating-ui skips layout-shift tracking. */
class IntersectionObserverShim implements IntersectionObserver {
  public readonly root: Element | Document | null = null;

  public readonly rootMargin: string = '0px';

  public readonly thresholds: readonly number[] = [0];

  public disconnect(): void {}

  public observe(): void {}

  public takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  public unobserve(): void {}
}

/**
 * Installs the observer shims on `globalThis` without clobbering an
 * implementation the environment already provides.
 */
function installObserverShims(): void {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = ResizeObserverShim;
  }

  if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = IntersectionObserverShim;
  }
}

/**
 * Installs the pointer-capture and scrolling no-ops Radix relies on.
 *
 * Kept as plain `if` guards (instead of `??=`) so the intent survives on a DOM
 * library that already ships one of the methods.
 */
function installPointerShims(): void {
  const prototype = Element.prototype;

  if (typeof prototype.hasPointerCapture !== 'function') {
    prototype.hasPointerCapture = (): boolean => false;
  }

  if (typeof prototype.setPointerCapture !== 'function') {
    prototype.setPointerCapture = (): void => {};
  }

  if (typeof prototype.releasePointerCapture !== 'function') {
    prototype.releasePointerCapture = (): void => {};
  }

  if (typeof prototype.scrollIntoView !== 'function') {
    prototype.scrollIntoView = (): void => {};
  }
}

installObserverShims();
installPointerShims();

/** The `userEvent` flavour every overlay test uses. */
export type OverlayUser = ReturnType<typeof userEvent.setup>;

/**
 * Creates the pointer-tolerant `userEvent` instance of the overlay suites.
 *
 * @returns a `userEvent` instance that accepts clicks on a portalled overlay.
 */
export function createOverlayUser(): OverlayUser {
  return userEvent.setup({ pointerEventsCheck: 0 });
}
