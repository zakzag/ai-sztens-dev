import {
  isCustomerOwnerConflict,
  isCustomerUserEmailConflict,
  isCustomerUserInUse,
} from './customers-users.error-guard.js';

/**
 * Unit tests of the customer-user guards (AIS-178, slice e).
 *
 * Three constraints decide three different answers, so the cross cases matter as
 * much as the positive ones: an owner conflict must never be reported as a
 * duplicate e-mail, and a foreign-key failure on an unrelated constraint must stay
 * a `500`.
 */
describe('isCustomerUserEmailConflict', () => {
  it('recognises a 23505 on customer_users_email_key', () => {
    expect(
      isCustomerUserEmailConflict({
        code: '23505',
        constraint_name: 'customer_users_email_key',
      }),
    ).toBe(true);
  });

  it('walks a wrapped cause chain', () => {
    const error = new Error('DrizzleQueryError', {
      cause: { code: '23505', constraint_name: 'customer_users_email_key' },
    });

    expect(isCustomerUserEmailConflict(error)).toBe(true);
  });

  it('does not treat the owner index as a duplicate e-mail', () => {
    expect(
      isCustomerUserEmailConflict({
        code: '23505',
        constraint_name: 'customer_users_customer_owner_key',
      }),
    ).toBe(false);
  });
});

describe('isCustomerOwnerConflict', () => {
  it('recognises a 23505 on the partial owner index', () => {
    expect(
      isCustomerOwnerConflict({
        code: '23505',
        constraint_name: 'customer_users_customer_owner_key',
      }),
    ).toBe(true);
  });

  it('does not treat the e-mail index as an owner conflict', () => {
    expect(
      isCustomerOwnerConflict({
        code: '23505',
        constraint_name: 'customer_users_email_key',
      }),
    ).toBe(false);
  });
});

describe('isCustomerUserInUse', () => {
  it('recognises the contact reference', () => {
    expect(
      isCustomerUserInUse({
        code: '23503',
        constraint_name: 'contacts_customer_user_id_fkey',
      }),
    ).toBe(true);
  });

  it('recognises the activity reference', () => {
    expect(
      isCustomerUserInUse({
        code: '23503',
        constraint_name: 'activities_customer_user_id_fkey',
      }),
    ).toBe(true);
  });

  it('rejects a foreign-key failure on another constraint', () => {
    expect(
      isCustomerUserInUse({
        code: '23503',
        constraint_name: 'customer_tags_tag_id_tags_id_fk',
      }),
    ).toBe(false);
  });

  it('rejects a unique violation of the same table', () => {
    expect(
      isCustomerUserInUse({
        code: '23505',
        constraint_name: 'contacts_customer_user_id_fkey',
      }),
    ).toBe(false);
  });
});
