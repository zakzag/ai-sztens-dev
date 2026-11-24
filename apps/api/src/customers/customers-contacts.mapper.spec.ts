import {
  hasContactPatch,
  isSameRoleSet,
  toContact,
  toContactAuditPayload,
  toContactPatch,
  toContactsWithRoles,
  toNewContactRow,
  toRoleAuditPayload,
  toRoleRows,
} from './customers-contacts.mapper.js';
import {
  CONTACT_CREATED_AT,
  CONTACT_CUSTOMER_ID,
  CONTACT_DELETED_AT,
  CONTACT_ID,
  CONTACT_UPDATED_AT,
  SECOND_CONTACT_ID,
  buildContactRow,
  buildContactWithRoles,
  buildCreateContactInput,
  buildRoleRows,
  buildUpdateContactInput,
} from './test/mocks/customers-contacts.mock.js';

/**
 * Unit tests of the contact mapper (AIS-178, slice d).
 *
 * The mapper is the only place that answers "what does a row look like on the
 * wire", so every branch is asserted here: `null` vs. `undefined`, `Date` vs. ISO
 * string, a role set that did not change, and the grouping that turns a page plus
 * its role rows into one entry per contact.
 */

describe('toContact', () => {
  it('maps every column and both timestamps to ISO strings', () => {
    const payload = toContact(buildContactWithRoles(['primary', 'technical']));

    expect(payload).toEqual({
      id: CONTACT_ID,
      customerId: CONTACT_CUSTOMER_ID,
      name: 'Nagy Anna',
      position: 'Ügyvezető',
      email: 'anna.nagy@pelda.hu',
      phone: '+36301234567',
      customerUserId: null,
      isActive: true,
      roles: ['primary', 'technical'],
      createdAt: CONTACT_CREATED_AT.toISOString(),
      updatedAt: CONTACT_UPDATED_AT.toISOString(),
    });
  });

  it('never publishes `deletedAt` — an archived row is invisible by construction', () => {
    const payload = toContact(
      buildContactWithRoles(['primary'], { deletedAt: CONTACT_DELETED_AT }),
    );

    expect('deletedAt' in payload).toBe(false);
  });

  it('copies the role array so a caller cannot mutate the payload', () => {
    const source = buildContactWithRoles(['primary']);

    const payload = toContact(source);

    payload.roles.push('alerting');
    expect(source.roles).toEqual(['primary']);
  });
});

describe('toNewContactRow', () => {
  it('takes the customer from the route and starts the contact active', () => {
    const row = toNewContactRow(
      CONTACT_CUSTOMER_ID,
      buildCreateContactInput({ roles: undefined }),
    );

    expect(row.customerId).toBe(CONTACT_CUSTOMER_ID);
    expect(row.isActive).toBe(true);
    expect(row.name).toBe('Szabó Judit');
  });

  it('turns an omitted optional field into an explicit null', () => {
    const row = toNewContactRow(
      CONTACT_CUSTOMER_ID,
      buildCreateContactInput({ position: undefined, email: undefined }),
    );

    expect(row.position).toBeNull();
    expect(row.email).toBeNull();
  });
});

describe('toContactPatch', () => {
  it('keeps an absent field absent and passes an explicit null through', () => {
    const patch = toContactPatch(
      buildUpdateContactInput({ position: null, email: undefined }),
    );

    expect(patch).toEqual({ position: null });
  });

  it('never writes the concurrency token', () => {
    const patch = toContactPatch(buildUpdateContactInput());

    expect('updatedAt' in patch).toBe(false);
  });

  it('never writes the role set into the row patch', () => {
    const patch = toContactPatch(
      buildUpdateContactInput({ roles: ['primary'] }),
    );

    expect('roles' in patch).toBe(false);
  });
});

describe('hasContactPatch', () => {
  it('reports an empty patch', () => {
    expect(hasContactPatch({})).toBe(false);
  });

  it('reports a patch that carries one column', () => {
    expect(hasContactPatch({ isActive: false })).toBe(true);
  });
});

describe('toRoleRows', () => {
  it('denormalises the customer id into every row', () => {
    const rows = toRoleRows(CONTACT_ID, CONTACT_CUSTOMER_ID, [
      'primary',
      'alerting',
    ]);

    expect(rows).toEqual([
      {
        contactId: CONTACT_ID,
        customerId: CONTACT_CUSTOMER_ID,
        role: 'primary',
      },
      {
        contactId: CONTACT_ID,
        customerId: CONTACT_CUSTOMER_ID,
        role: 'alerting',
      },
    ]);
  });

  it('returns no rows for an empty role set', () => {
    expect(toRoleRows(CONTACT_ID, CONTACT_CUSTOMER_ID, [])).toEqual([]);
  });
});

describe('isSameRoleSet', () => {
  it('is order-insensitive', () => {
    expect(
      isSameRoleSet(['primary', 'technical'], ['technical', 'primary']),
    ).toBe(true);
  });

  it('detects a missing role', () => {
    expect(isSameRoleSet(['primary'], ['primary', 'alerting'])).toBe(false);
  });

  it('detects a different role of the same size', () => {
    expect(isSameRoleSet(['primary'], ['alerting'])).toBe(false);
  });
});

describe('toContactsWithRoles', () => {
  it('attaches the roles to their contact and keeps the page order', () => {
    const first = buildContactRow();
    const second = buildContactRow({
      id: SECOND_CONTACT_ID,
      name: 'Tóth Béla',
    });

    const grouped = toContactsWithRoles(
      [first, second],
      [
        {
          contactId: CONTACT_ID,
          customerId: CONTACT_CUSTOMER_ID,
          role: 'primary',
        },
        {
          contactId: SECOND_CONTACT_ID,
          customerId: CONTACT_CUSTOMER_ID,
          role: 'technical',
        },
      ],
    );

    expect(grouped.map((entry) => entry.contact.id)).toEqual([
      CONTACT_ID,
      SECOND_CONTACT_ID,
    ]);
    expect(grouped[0]?.roles).toEqual(['primary']);
    expect(grouped[1]?.roles).toEqual(['technical']);
  });

  it('gives a contact without roles an empty array, never a missing entry', () => {
    const grouped = toContactsWithRoles([buildContactRow()], []);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.roles).toEqual([]);
  });
});

describe('toContactAuditPayload', () => {
  it('spells out every business column and ISO-serialises the dates', () => {
    const payload = toContactAuditPayload(
      buildContactRow({ deletedAt: CONTACT_DELETED_AT }),
    );

    expect(payload).toMatchObject({
      id: CONTACT_ID,
      customerId: CONTACT_CUSTOMER_ID,
      isActive: true,
      createdAt: CONTACT_CREATED_AT.toISOString(),
      updatedAt: CONTACT_UPDATED_AT.toISOString(),
      deletedAt: CONTACT_DELETED_AT.toISOString(),
    });
  });
});

describe('toRoleAuditPayload', () => {
  it('carries the pair instead of an invented record id', () => {
    const payload = toRoleAuditPayload(CONTACT_CUSTOMER_ID, CONTACT_ID, [
      'primary',
    ]);

    expect(payload).toEqual({
      contactId: CONTACT_ID,
      customerId: CONTACT_CUSTOMER_ID,
      roles: ['primary'],
    });
  });

  it('copies the role array', () => {
    const payload = toRoleAuditPayload(
      CONTACT_CUSTOMER_ID,
      CONTACT_ID,
      buildRoleRows(['primary']).map((row) => row.role),
    );

    expect(payload['roles']).toEqual(['primary']);
  });
});
