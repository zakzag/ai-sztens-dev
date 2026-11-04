/**
 * Mock of the form notification port (AIS-115, plan `D2`).
 *
 * The hook takes `FormNotifier` as a dependency instead of importing a toast
 * library, so the whole feedback convention is assertable today — before AIS-84
 * exists — by passing this mock and checking the arguments it received.
 */

import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { FormNotifier } from '../../features/forms/use-app-form.interface.js';

/** The spy type of {@link FormNotifier.success}. */
export type FormNotifierSuccessSpy = Mock<(message: string) => void>;

/** A {@link FormNotifier} whose single method is a spy. */
export interface FormNotifierMock extends FormNotifier {
  readonly success: FormNotifierSuccessSpy;
}

/**
 * @returns a notifier that records every success message it is given.
 */
export function createFormNotifierMock(): FormNotifierMock {
  return { success: vi.fn<(message: string) => void>() };
}
