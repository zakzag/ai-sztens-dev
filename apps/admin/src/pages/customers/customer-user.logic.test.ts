/**
 * Tests of the two login-user form rules (AIS-179).
 *
 * The interesting edge is the status set: the edit schema must reject `invited`,
 * because `updateCustomerUserSchema` is `.strict()` and the API refuses a
 * server-written state.
 */

import { describe, expect, it } from 'vitest';
import type { CustomerUserViewModel } from '../../entities/customer/customer.interface.js';
import {
  customerUserEditFormSchema,
  customerUserInviteFormSchema,
  EMPTY_USER_INVITE_FORM_VALUES,
  toCustomerUserEditFormValues,
  toInviteCustomerUserInput,
  toUpdateCustomerUserInput,
} from './customer-user.logic.js';

/** A mapped login user in the `invited` state. */
const INVITED_ROW: CustomerUserViewModel = {
  id: 'user-1',
  name: 'Nagy Béla',
  email: 'bela@example.com',
  role: 'owner',
  roleLabel: 'Tulajdonos',
  status: 'invited',
  statusLabel: 'Meghívva',
  statusVariant: 'info',
  invitedAtText: '2026-11-01 10:00',
  lastLoginText: '—',
  isInvited: true,
  updatedAt: '2026-11-01T10:00:00.000Z',
};

describe('customerUserInviteFormSchema', () => {
  it('accepts a filled invitation', () => {
    expect(
      customerUserInviteFormSchema.safeParse({
        name: 'Nagy Béla',
        email: 'bela@example.com',
        role: 'member',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty name', () => {
    expect(
      customerUserInviteFormSchema.safeParse({
        name: '   ',
        email: 'bela@example.com',
        role: 'member',
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed e-mail address', () => {
    expect(
      customerUserInviteFormSchema.safeParse({
        name: 'Nagy Béla',
        email: 'not-an-address',
        role: 'member',
      }).success,
    ).toBe(false);
  });
});

describe('customerUserEditFormSchema', () => {
  it('accepts the two managed statuses', () => {
    for (const status of ['active', 'inactive'] as const) {
      expect(
        customerUserEditFormSchema.safeParse({
          name: 'Nagy Béla',
          role: 'member',
          status,
        }).success,
      ).toBe(true);
    }
  });

  it('rejects the server-written invited status', () => {
    expect(
      customerUserEditFormSchema.safeParse({
        name: 'Nagy Béla',
        role: 'member',
        status: 'invited',
      }).success,
    ).toBe(false);
  });
});

describe('toCustomerUserEditFormValues', () => {
  it('seeds name, role and the managed status', () => {
    expect(
      toCustomerUserEditFormValues({ ...INVITED_ROW, status: 'inactive' }),
    ).toEqual({ name: 'Nagy Béla', role: 'owner', status: 'inactive' });
  });

  it('falls back to active for an invited row', () => {
    expect(toCustomerUserEditFormValues(INVITED_ROW).status).toBe('active');
  });
});

describe('payload builders', () => {
  it('trims the name and keeps the normalised e-mail of an invitation', () => {
    expect(
      toInviteCustomerUserInput({
        name: '  Nagy Béla  ',
        email: 'bela@example.com',
        role: 'admin',
      }),
    ).toEqual({ name: 'Nagy Béla', email: 'bela@example.com', role: 'admin' });
  });

  it('always carries the concurrency token of an edit', () => {
    expect(
      toUpdateCustomerUserInput(
        { name: 'Nagy Béla', role: 'viewer', status: 'inactive' },
        'v3',
      ),
    ).toEqual({
      name: 'Nagy Béla',
      role: 'viewer',
      status: 'inactive',
      updatedAt: 'v3',
    });
  });

  it('starts an invitation with the server default role', () => {
    expect(EMPTY_USER_INVITE_FORM_VALUES.role).toBe('member');
  });
});
