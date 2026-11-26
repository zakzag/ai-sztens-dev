import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_EVENT_DEFAULTS,
  NOTIFICATION_EVENT_KINDS,
} from '../src/core/notification-event.const.js';
import { NOTIFICATION_LEVELS, NOTIFICATION_SOURCES } from '../src/core/notification.const.js';

describe('notification event catalogue', () => {
  it('classifies every catalogued kind', () => {
    expect(Object.keys(NOTIFICATION_EVENT_DEFAULTS).sort()).toEqual(
      [...NOTIFICATION_EVENT_KINDS].sort(),
    );
  });

  it.each(NOTIFICATION_EVENT_KINDS)('uses a known level for %s', (kind) => {
    expect(NOTIFICATION_LEVELS).toContain(NOTIFICATION_EVENT_DEFAULTS[kind].level);
  });

  it.each(NOTIFICATION_EVENT_KINDS)('uses a known source for %s', (kind) => {
    expect(NOTIFICATION_SOURCES).toContain(NOTIFICATION_EVENT_DEFAULTS[kind].source);
  });

  it.each(NOTIFICATION_EVENT_KINDS)('carries no user-facing copy for %s', (kind) => {
    expect(Object.keys(NOTIFICATION_EVENT_DEFAULTS[kind]).sort()).toEqual([
      'level',
      'source',
      'toast',
    ]);
  });

  it('keeps the noisy events log-only', () => {
    expect(NOTIFICATION_EVENT_DEFAULTS['router.navigation'].toast).toBe(false);
    expect(NOTIFICATION_EVENT_DEFAULTS['api.schema-drift'].toast).toBe(false);
  });

  it('toasts a successful form submission', () => {
    expect(NOTIFICATION_EVENT_DEFAULTS['form.success']).toEqual({
      level: 'success',
      source: 'form',
      toast: true,
    });
  });
});
