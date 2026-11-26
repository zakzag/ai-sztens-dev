/**
 * Tests of the render-crash emitter (AIS-136 `G3`).
 *
 * The emitter is a thin adapter over the catalogued `runtime.error` defaults, so
 * every test drives a **real** store and asserts what landed in it. That is the
 * only way to prove the two things that matter: the crash is announced (a toast)
 * and the recorded detail respects `includeDetails`.
 */

import { createNotificationStore } from '@callback/notifications';
import { RUNTIME_ERROR_MESSAGE } from '@callback/notifications/react';
import { describe, expect, it } from 'vitest';
import { createRuntimeErrorEmitter } from './runtime-error.js';

/**
 * @param includeDetails - whether the stack may be recorded.
 * @param error - the thrown value the boundary would report.
 * @returns the store and the single entry the emitter produced.
 */
function emitOnce(includeDetails: boolean, error: unknown) {
  const store = createNotificationStore();

  createRuntimeErrorEmitter(store, includeDetails)({
    error,
    componentStack: 'at Broken (App.tsx:1)',
  });

  const state = store.getSnapshot();

  return { store, state, entry: state.entries[0] };
}

describe('createRuntimeErrorEmitter', () => {
  it('files one error entry with the runtime source', () => {
    const { state, entry } = emitOnce(false, new Error('boom'));

    expect(state.entries).toHaveLength(1);
    expect(entry.level).toBe('error');
    expect(entry.source).toBe('runtime');
    expect(entry.message).toBe(RUNTIME_ERROR_MESSAGE);
  });

  it('asks for a toast, so the crash is announced', () => {
    const { state, entry } = emitOnce(false, new Error('boom'));

    expect(entry.toast).toBe(true);
    expect(state.toasts).toEqual([entry.id]);
  });

  it('keeps name and message but not the stack by default', () => {
    const { entry } = emitOnce(false, new TypeError('boom'));

    expect(entry.detail).toContain('TypeError');
    expect(entry.detail).toContain('boom');
    expect(entry.detail).not.toContain('stack');
  });

  it('records the stack when details are allowed', () => {
    const { entry } = emitOnce(true, new Error('boom'));

    expect(entry.detail).toContain('stack');
  });

  it('handles a thrown non-error value', () => {
    const { entry } = emitOnce(false, 'boom');

    expect(entry.message).toBe(RUNTIME_ERROR_MESSAGE);
    expect(entry.detail).toContain('boom');
  });

  it('dedupes two identical crashes into one bumped entry', () => {
    // Every crash carries the same catalogue sentence, so the store's dedupe
    // window turns an immediate repeat into `repeatCount`, not a second card.
    const store = createNotificationStore();
    const emit = createRuntimeErrorEmitter(store, false);

    emit({ error: new Error('first'), componentStack: null });
    emit({ error: new Error('second'), componentStack: null });

    const state = store.getSnapshot();

    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.repeatCount).toBe(2);
    expect(state.toasts).toHaveLength(1);
  });
});
