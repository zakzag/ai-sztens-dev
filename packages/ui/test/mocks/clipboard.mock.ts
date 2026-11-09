import { vi } from 'vitest';

/**
 * Clipboard fake the copy controls are tested against.
 *
 * jsdom does not implement `navigator.clipboard`, so a component that copies
 * would silently fall back to "not supported" in every test — the successful
 * path would be unreachable. The stub is defined here (and not inside the test
 * file) because the repo rule puts every stub under `test/mocks`.
 */
export interface ClipboardStubs {
  /** Spy behind `navigator.clipboard.writeText`. */
  readonly writeText: ReturnType<typeof vi.fn>;
  /** Removes the stub and restores whatever `navigator.clipboard` was before. */
  readonly restore: () => void;
}

/** Optional behaviour of the installed `writeText`. */
export interface ClipboardStubOptions {
  /**
   * Replacement for the real write, e.g. one that rejects to exercise the
   * silent degradation path. Defaults to a resolved promise.
   */
  readonly writeText?: (text: string) => Promise<void>;
}

/**
 * Installs a `navigator.clipboard` whose `writeText` records its arguments.
 *
 * @param options - optional replacement `writeText` implementation.
 * @returns the spy and a `restore` that puts the original descriptor back.
 */
export function stubClipboard(
  options: ClipboardStubOptions = {},
): ClipboardStubs {
  return installClipboard({
    writeText: vi.fn(options.writeText ?? (() => Promise.resolve())),
  });
}

/**
 * Removes `navigator.clipboard` entirely.
 *
 * The other half of `copyText`'s contract: a browser (or a test runner) without
 * the API must get `false`, not an exception.
 *
 * @returns a `restore` that puts the original descriptor back.
 */
export function stubClipboardMissing(): () => void {
  return installClipboard(undefined).restore;
}

/**
 * Replaces the `clipboard` property of `navigator` and returns the undo.
 *
 * A property descriptor (not a plain assignment) because `navigator.clipboard`
 * is a getter in the browsers that have it, and `restore` has to put the exact
 * previous state back so one test cannot leak into the next.
 *
 * @param value - the fake clipboard object, or `undefined` to remove it.
 * @returns the stub for `writeText` and the restore callback.
 */
function installClipboard(
  value: { writeText: ReturnType<typeof vi.fn> } | undefined,
): ClipboardStubs {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  });

  return {
    writeText: value?.writeText ?? vi.fn(),
    restore: () => {
      if (previous === undefined) {
        Object.defineProperty(navigator, 'clipboard', {
          value: undefined,
          configurable: true,
          writable: true,
        });

        return;
      }

      Object.defineProperty(navigator, 'clipboard', previous);
    },
  };
}
