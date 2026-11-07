import { vi } from 'vitest';

/**
 * The pointer-capture methods the resize handle calls.
 *
 * jsdom implements neither `setPointerCapture` nor `releasePointerCapture`, so a
 * component that captures the pointer would throw in every pointer test. The
 * mock is defined here (and not inside the test file) because the repo rule puts
 * every stub under `test/mocks`.
 */
export interface PointerCaptureStubs {
  readonly setPointerCapture: ReturnType<typeof vi.fn>;
  readonly releasePointerCapture: ReturnType<typeof vi.fn>;
  readonly hasPointerCapture: ReturnType<typeof vi.fn>;
}

/**
 * Everything a synthetic pointer event has to carry for the handle.
 */
export interface PointerDispatchInit {
  /** Pointer id the capture lifecycle is keyed by. */
  readonly pointerId: number;
  /** Horizontal viewport coordinate, in CSS pixels. */
  readonly clientX: number;
}

/**
 * Installs pointer-capture stubs on one element.
 *
 * `hasPointerCapture` answers `true`, which is the state a real drag is in after
 * `pointerdown` — that is what makes `releasePointerCapture` reachable in a
 * single `pointerup`.
 *
 * @param target - the element the handler calls `setPointerCapture` on.
 * @returns the spies, so a test can assert the capture lifecycle.
 */
export function stubPointerCapture(target: Element): PointerCaptureStubs {
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  const hasPointerCapture = vi.fn(() => true);

  Object.defineProperty(target, 'setPointerCapture', {
    value: setPointerCapture,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(target, 'releasePointerCapture', {
    value: releasePointerCapture,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(target, 'hasPointerCapture', {
    value: hasPointerCapture,
    configurable: true,
    writable: true,
  });

  return { setPointerCapture, releasePointerCapture, hasPointerCapture };
}

/**
 * Dispatches one pointer event that React's handler can actually read.
 *
 * `fireEvent.pointerMove(el, { clientX })` is not enough: this jsdom build has
 * no `PointerEvent` constructor, so the init is dropped and the handler sees
 * `clientX: undefined` (which the drawer then correctly treats as `NaN`). A
 * bubbling `MouseEvent` carries `clientX`, and `pointerId` is attached as an own
 * property — the two fields the resize logic depends on.
 *
 * @param target - element to dispatch on; the event bubbles to React's root.
 * @param type - `pointerdown`, `pointermove`, `pointerup` or `pointercancel`.
 * @param init - pointer id and viewport coordinate.
 */
export function dispatchPointerEvent(
  target: Element,
  type: string,
  init: PointerDispatchInit,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
  });

  Object.defineProperty(event, 'pointerId', { value: init.pointerId });

  target.dispatchEvent(event);
}
