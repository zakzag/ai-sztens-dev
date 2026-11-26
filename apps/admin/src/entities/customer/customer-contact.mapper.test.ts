/**
 * Tests of the contact and login-user mappers (AIS-179).
 *
 * The mapper is the only place where a `null` position, an empty role set or an
 * `invited` status gets its final shape, so every branch of it is asserted here —
 * with plain values, no React and no network.
 */

import { describe, expect, it } from 'vitest';
import type { Contact, CustomerUser } from '@callback/shared';
import { VALID_CONTACT, VALID_CUSTOMER_USER } from '@callback/shared';
import {
  CONTACT_ROLE_BADGE_VARIANT,
  CONTACT_ROLE_LABELS,
  CUSTOMER_CONTACT_ACTIVE_LABEL,
  CUSTOMER_CONTACT_INACTIVE_LABEL,
  CUSTOMER_CONTACT_LOGIN_USER_LABEL,
  CUSTOMER_EMPTY_VALUE_LABEL,
  CUSTOMER_USER_ROLE_LABELS,
  CUSTOMER_USER_STATUS_BADGE_VARIANT,
  CUSTOMER_USER_STATUS_LABELS,
} from './customer.const.js';
import {
  toCustomerContactViewModel,
  toCustomerContactViewModels,
  toCustomerUserViewModel,
  toCustomerUserViewModels,
} from './customer.mapper.js';

/** A contact with every optional field cleared, so each default is visible. */
const EMPTY_CONTACT: Contact = {
  ...VALID_CONTACT,
  position: null,
  email: null,
  phone: null,
  customerUserId: null,
  roles: [],
  isActive: false,
};

/** A login user in the server-written `invited` state. */
const INVITED_USER: CustomerUser = {
  ...VALID_CUSTOMER_USER,
  status: 'invited',
};

describe('toCustomerContactViewModel', () => {
  it('maps every role to its label and badge variant', () => {
    const mapped = toCustomerContactViewModel({
      ...EMPTY_CONTACT,
      roles: ['primary', 'technical', 'alerting'],
    });

    expect(mapped.roleBadges).toEqual([
      {
        role: 'primary',
        label: CONTACT_ROLE_LABELS.primary,
        variant: CONTACT_ROLE_BADGE_VARIANT.primary,
      },
      {
        role: 'technical',
        label: CONTACT_ROLE_LABELS.technical,
        variant: CONTACT_ROLE_BADGE_VARIANT.technical,
      },
      {
        role: 'alerting',
        label: CONTACT_ROLE_LABELS.alerting,
        variant: CONTACT_ROLE_BADGE_VARIANT.alerting,
      },
    ]);
  });

  it('renders an empty role set as an empty badge list', () => {
    expect(toCustomerContactViewModel(EMPTY_CONTACT).roleBadges).toEqual([]);
  });

  it('renders every cleared optional text as the empty-value placeholder', () => {
    const mapped = toCustomerContactViewModel(EMPTY_CONTACT);

    expect(mapped.positionText).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
    expect(mapped.emailText).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
    expect(mapped.phoneText).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
  });

  it('keeps the real text of a filled optional field', () => {
    const mapped = toCustomerContactViewModel(VALID_CONTACT);

    expect(mapped.name).toBe(VALID_CONTACT.name);
    expect(mapped.updatedAt).toBe(VALID_CONTACT.updatedAt);
  });

  it('marks a contact that is also a login user', () => {
    const mapped = toCustomerContactViewModel({
      ...VALID_CONTACT,
      customerUserId: VALID_CUSTOMER_USER.id,
    });

    expect(mapped.isLoginUser).toBe(true);
    expect(mapped.loginUserText).toBe(CUSTOMER_CONTACT_LOGIN_USER_LABEL);
  });

  it('leaves the login-user marker empty for a plain contact', () => {
    const mapped = toCustomerContactViewModel(EMPTY_CONTACT);

    expect(mapped.isLoginUser).toBe(false);
    expect(mapped.loginUserText).toBeNull();
  });

  it('uses the inactive copy for an inactive contact', () => {
    expect(toCustomerContactViewModel(EMPTY_CONTACT).activeText).toBe(
      CUSTOMER_CONTACT_INACTIVE_LABEL,
    );
    expect(
      toCustomerContactViewModel({ ...EMPTY_CONTACT, isActive: true }).activeText,
    ).toBe(CUSTOMER_CONTACT_ACTIVE_LABEL);
  });

  it('maps a list in server order', () => {
    const mapped = toCustomerContactViewModels([VALID_CONTACT, EMPTY_CONTACT]);

    expect(mapped.map((row) => row.id)).toEqual([
      VALID_CONTACT.id,
      EMPTY_CONTACT.id,
    ]);
  });
});

describe('toCustomerUserViewModel', () => {
  it('maps role and status through the entity tables', () => {
    const mapped = toCustomerUserViewModel(VALID_CUSTOMER_USER);

    expect(mapped.roleLabel).toBe(
      CUSTOMER_USER_ROLE_LABELS[VALID_CUSTOMER_USER.role],
    );
    expect(mapped.statusLabel).toBe(
      CUSTOMER_USER_STATUS_LABELS[VALID_CUSTOMER_USER.status],
    );
    expect(mapped.statusVariant).toBe(
      CUSTOMER_USER_STATUS_BADGE_VARIANT[VALID_CUSTOMER_USER.status],
    );
  });

  it('flags a pending invitation as revocable', () => {
    expect(toCustomerUserViewModel(INVITED_USER).isInvited).toBe(true);
  });

  it('does not flag an accepted user as revocable', () => {
    const mapped = toCustomerUserViewModel({
      ...VALID_CUSTOMER_USER,
      status: 'active',
    });

    expect(mapped.isInvited).toBe(false);
  });

  it('renders a missing last login as the empty-value placeholder', () => {
    const mapped = toCustomerUserViewModel({
      ...VALID_CUSTOMER_USER,
      lastLoginAt: null,
    });

    expect(mapped.lastLoginText).toBe(CUSTOMER_EMPTY_VALUE_LABEL);
  });

  it('maps a list in server order', () => {
    const mapped = toCustomerUserViewModels([
      VALID_CUSTOMER_USER,
      { ...VALID_CUSTOMER_USER, id: 'other-user' },
    ]);

    expect(mapped).toHaveLength(2);
    expect(mapped[1].id).toBe('other-user');
  });
});
