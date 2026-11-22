import { AUDIT_SYSTEM_ACTOR_NAME } from './audit.const.js';
import { SystemAuditActorProvider } from './audit-actor.provider.js';

/**
 * Unit tests for the pre-auth actor provider (AIS-177 `D6`).
 *
 * The provider is the seam the auth story replaces, so its contract is narrow on
 * purpose: always an actor, always the same truth today, never `null`.
 */
describe('SystemAuditActorProvider', () => {
  it('resolves the system actor', () => {
    const provider = new SystemAuditActorProvider();

    expect(provider.resolve()).toEqual({
      type: 'system',
      id: null,
      name: AUDIT_SYSTEM_ACTOR_NAME,
    });
  });

  it('returns a fresh object, so a caller cannot mutate the shared actor', () => {
    const provider = new SystemAuditActorProvider();

    expect(provider.resolve()).not.toBe(provider.resolve());
  });

  it('never claims an id, because no operator row is authenticated', () => {
    const actor = new SystemAuditActorProvider().resolve();

    expect(actor.id).toBeNull();
    expect(actor.type).toBe('system');
  });
});
