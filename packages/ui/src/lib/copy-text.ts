/**
 * Best-effort clipboard write, isolated in `lib/` on purpose.
 *
 * Writing to the clipboard is the only real side effect the log drawer needs
 * (AIS-153 decision D-F), and a component that calls `navigator.clipboard`
 * directly cannot be tested without stubbing a global on the component itself.
 * Keeping the browser API here means the component gets a plain
 * `Promise<boolean>` and the tests stub exactly one seam.
 *
 * Failure is **silent by design**:
 *
 * - `navigator` may be absent (SSR, a non-DOM test runner),
 * - the `clipboard` object may be missing (older browsers, non-secure origin),
 * - `writeText` may reject (permission denied, document not focused).
 *
 * None of those is a user-visible error worth an exception or a console
 * warning: the copy controls simply keep their action label instead of flashing
 * "Kimásolva". Returning `false` instead of throwing is what keeps the caller's
 * handler free of `try/catch`.
 *
 * @param text - the exact text the user asked to copy.
 * @returns `true` when the clipboard accepted the text, `false` otherwise.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    const clipboard =
      typeof navigator === 'undefined' ? undefined : navigator.clipboard;

    if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
      return false;
    }

    await clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}
