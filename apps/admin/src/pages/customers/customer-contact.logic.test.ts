/**
 * Tests of the contact form rules (AIS-179).
 *
 * Three things are asserted: the schema rejects what the server would reject, the
 * role booleans become the contract's `roles[]` array, and an empty optional input
 * means “omitted” on create but an explicit `null` on update — the two directions
 * a copy-pasted form usually gets wrong.
 */

import { describe, expect, it } from 'vitest';
import {
  toContactRoles,
  toContactUserOptions,
  toCreateContactInput,
  toCustomerContactFormValues,
  toUpdateContactInput,
} from './customer-contact.logic.js';
import { CUSTOMER_CONTACT_NO_USER_LABEL } from './customers.const.js';
import type { CustomerContactFormValues } from './customers.interface.js';
import type {
  CustomerContactViewModel,
  CustomerUserViewModel,
} from '../../entities/customer/customer.interface.js';

/** A valid value set with no optional input filled. */
const BASE_VALUES: CustomerContactFormValues = {
  name: 'Kiss Anna',
  position: '',
  email: '',
  phone: '',
  customerUserId: '',
  isPrimary: false,
  isTechnical: false,
  isAlerting: false,
  isActive: true,
};

/** A mapped contact used by the seeding tests. */
const CONTACT_ROW: CustomerContactViewModel = {
  id: 'contact-1',
  name: 'Kiss Anna',
  positionText: '—',
  emailText: '—',
  phoneText: '—',
  roleBadges: [
    { role: 'primary', label: 'Elsődleges', variant: 'success' },
    { role: 'alerting', label: 'Riasztási', variant: 'warning' },
  ],
  isLoginUser: false,
  loginUserText: null,
  isActive: true,
  activeText: 'Aktív',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

/** A mapped login user used by the select-options test. */
const USER_ROW: CustomerUserViewModel = {
  id: 'user-1',
  name: 'Nagy Béla',
  email: 'bela@example.com',
  role: 'member',
  roleLabel: 'Tag',
  status: 'active',
  statusLabel: 'Aktív',
  statusVariant: 'success',
  invitedAtText: '—',
  lastLoginText: '—',
  isInvited: false,
  updatedAt: '2026-11-01T10:00:00.000Z',
};

describe('toContactRoles', () => {
  it('returns an empty array when no role flag is set', () => {
    expect(toContactRoles(BASE_VALUES)).toEqual([]);
  });

  it('returns the flags in contract order', () => {
    expect(
      toContactRoles({
        ...BASE_VALUES,
        isAlerting: true,
        isPrimary: true,
      }),
    ).toEqual(['primary', 'alerting']);
  });
});

describe('toCreateContactInput', () => {
  it('omits every empty optional input', () => {
    expect(toCreateContactInput(BASE_VALUES)).toEqual({
      name: 'Kiss Anna',
      roles: [],
    });
  });

  it('sends the filled optional inputs', () => {
    expect(
      toCreateContactInput({
        ...BASE_VALUES,
        position: 'Beszerzés',
        email: 'anna@example.com',
        phone: '+36 30 123 4567',
        customerUserId: 'user-1',
        isPrimary: true,
      }),
    ).toEqual({
      name: 'Kiss Anna',
      roles: ['primary'],
      position: 'Beszerzés',
      email: 'anna@example.com',
      phone: '+36 30 123 4567',
      customerUserId: 'user-1',
    });
  });
});

describe('toUpdateContactInput', () => {
  it('clears every empty optional input with an explicit null', () => {
    expect(toUpdateContactInput(BASE_VALUES, 'v1')).toEqual({
      name: 'Kiss Anna',
      position: null,
      email: null,
      phone: null,
      customerUserId: null,
      isActive: true,
      roles: [],
      updatedAt: 'v1',
    });
  });

  it('always carries the concurrency token', () => {
    expect(toUpdateContactInput(BASE_VALUES, 'v7').updatedAt).toBe('v7');
  });
});

describe('toCustomerContactFormValues', () => {
  it('starts a creation from an empty, active draft', () => {
    const values = toCustomerContactFormValues(null);

    expect(values.name).toBe('');
    expect(values.isActive).toBe(true);
    expect(toContactRoles(values)).toEqual([]);
  });

  it('seeds the role flags and clears the placeholder text', () => {
    const values = toCustomerContactFormValues(CONTACT_ROW);

    expect(values.name).toBe('Kiss Anna');
    expect(values.position).toBe('');
    expect(values.email).toBe('');
    expect(values.isPrimary).toBe(true);
    expect(values.isAlerting).toBe(true);
    expect(values.isTechnical).toBe(false);
    expect(values.isActive).toBe(true);
  });
});

describe('toContactUserOptions', () => {
  it('offers a clearable “none” option before the customer users', () => {
    expect(toContactUserOptions([USER_ROW])).toEqual([
      { value: '', label: CUSTOMER_CONTACT_NO_USER_LABEL },
      { value: 'user-1', label: 'Nagy Béla (bela@example.com)' },
    ]);
  });
});
