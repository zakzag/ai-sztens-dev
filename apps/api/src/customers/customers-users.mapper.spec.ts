import {
  hasCustomerUserPatch,
  toCustomerUser,
  toCustomerUserAuditPayload,
  toCustomerUserPatch,
  toNewCustomerUserRow,
} from './customers-users.mapper.js';
import {
  CUSTOMER_USER_ID,
  USER_INVITED_AT,
  USERS_CUSTOMER_ID,
  buildCustomerUserRowFixture,
  buildInviteInput,
  buildUpdateCustomerUserInput,
} from './test/mocks/customers-users.mock.js';

/**
 * Unit tests of the customer-user mapping (AIS-178, slice e).
 *
 * The invite mapping is the security-relevant one: `status`, `invitedAt`,
 * `invitedByOperatorId` and the auth columns are **server** values, so each of them
 * is asserted explicitly rather than through a snapshot.
 */
describe('toCustomerUser', () => {
  it('maps a row to the wire payload with ISO timestamps', () => {
    expect(toCustomerUser(buildCustomerUserRowFixture())).toEqual({
      id: CUSTOMER_USER_ID,
      customerId: USERS_CUSTOMER_ID,
      name: 'Kiss Péter',
      email: 'peter.kiss@pelda.hu',
      role: 'owner',
      status: 'invited',
      invitedByOperatorId: null,
      invitedAt: USER_INVITED_AT.toISOString(),
      acceptedAt: null,
      lastLoginAt: null,
      createdAt: USER_INVITED_AT.toISOString(),
      updatedAt: USER_INVITED_AT.toISOString(),
    });
  });

  it('keeps a null last login and a null acceptance as null', () => {
    const payload = toCustomerUser(buildCustomerUserRowFixture());

    expect(payload.acceptedAt).toBeNull();
    expect(payload.lastLoginAt).toBeNull();
  });
});

describe('toNewCustomerUserRow', () => {
  it('writes the server-owned invitation state', () => {
    const row = toNewCustomerUserRow(
      USERS_CUSTOMER_ID,
      buildInviteInput(),
      USER_INVITED_AT,
    );

    expect(row).toEqual({
      customerId: USERS_CUSTOMER_ID,
      name: 'Kiss Péter',
      email: 'peter.kiss@pelda.hu',
      passwordHash: null,
      role: 'member',
      status: 'invited',
      invitedByOperatorId: null,
      invitedAt: USER_INVITED_AT,
      acceptedAt: null,
      lastLoginAt: null,
    });
  });

  it('falls back to the contract default role', () => {
    const row = toNewCustomerUserRow(
      USERS_CUSTOMER_ID,
      { name: 'Kiss Péter', email: 'peter.kiss@pelda.hu' },
      USER_INVITED_AT,
    );

    expect(row.role).toBe('member');
  });

  it('keeps an explicit role', () => {
    const row = toNewCustomerUserRow(
      USERS_CUSTOMER_ID,
      buildInviteInput({ role: 'owner' }),
      USER_INVITED_AT,
    );

    expect(row.role).toBe('owner');
  });
});

describe('toCustomerUserPatch', () => {
  it('keeps only the fields that were sent', () => {
    expect(toCustomerUserPatch(buildUpdateCustomerUserInput())).toEqual({
      status: 'active',
    });
  });

  it('returns an empty patch when only the token was sent', () => {
    const patch = toCustomerUserPatch({
      updatedAt: USER_INVITED_AT.toISOString(),
    });

    expect(patch).toEqual({});
    expect(hasCustomerUserPatch(patch)).toBe(false);
  });

  it('reports a patch that carries a field', () => {
    expect(
      hasCustomerUserPatch(
        toCustomerUserPatch({
          name: 'Új Név',
          updatedAt: USER_INVITED_AT.toISOString(),
        }),
      ),
    ).toBe(true);
  });
});

describe('toCustomerUserAuditPayload', () => {
  it('carries the business columns but never the password hash', () => {
    const payload = toCustomerUserAuditPayload(
      buildCustomerUserRowFixture({ passwordHash: 'secret-hash' }),
    );

    expect(payload).toMatchObject({
      id: CUSTOMER_USER_ID,
      email: 'peter.kiss@pelda.hu',
      role: 'owner',
      status: 'invited',
    });
    expect(payload).not.toHaveProperty('passwordHash');
  });
});
