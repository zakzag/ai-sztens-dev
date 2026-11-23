import {
  toContactsWithRoles,
  toCreatedListRow,
  toCustomer,
  toCustomerAuditPayload,
  toCustomerDetail,
  toCustomerPatch,
  toNewCustomerRow,
} from './customers.mapper.js';
import {
  CUSTOMER_CREATED_AT,
  CUSTOMER_DELETED_AT,
  CUSTOMER_LAST_ACTIVITY_AT,
  CUSTOMER_NUMBER,
  CUSTOMER_ROW_ID,
  CUSTOMER_UPDATED_AT,
  buildContactJoinRow,
  buildContactRow,
  buildCreateCustomerInput,
  buildCustomerDetailRows,
  buildCustomerRow,
  buildCustomerUserRow,
  buildRawCustomerRow,
  buildTagRow,
  buildUpdateCustomerInput,
} from './test/mocks/customers.mock.js';

/**
 * Unit tests of the pure mapping layer (AIS-178).
 *
 * Every branch the repository cannot prove is asserted here: `null` vs.
 * `undefined`, `Date` → ISO, and the derived values the mapper must **not**
 * recompute.
 */

describe('toCustomer', () => {
  it('maps every column and converts the timestamps to ISO strings', () => {
    const result = toCustomer(buildCustomerRow());

    expect(result).toEqual({
      id: CUSTOMER_ROW_ID,
      customerNumber: CUSTOMER_NUMBER,
      type: 'company',
      legalName: 'Példa Szolgáltató Kft.',
      shortName: 'Példa Kft.',
      taxNumber: '10773381-2-44',
      euVatNumber: 'HU10773381',
      companyRegistrationNumber: '01-09-123456',
      legalForm: 'Kft.',
      registeredAddressZip: '1051',
      registeredAddressCity: 'Budapest',
      registeredAddressLine: 'Széchenyi István tér 1.',
      registeredAddressCountry: 'HU',
      industry: 'Szoftverfejlesztés',
      headcountRange: '2_5',
      source: 'website',
      responsibleOperatorId: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
      status: 'active',
      statusChangedAt: new Date('2026-11-15T09:00:00.000Z').toISOString(),
      createdAt: CUSTOMER_CREATED_AT.toISOString(),
      updatedAt: CUSTOMER_UPDATED_AT.toISOString(),
      lastActivityAt: CUSTOMER_LAST_ACTIVITY_AT.toISOString(),
      hasMissingData: false,
      primaryContactName: 'Nagy Anna',
    });
  });

  it('keeps a missing activity timestamp and contact name as `null`', () => {
    const result = toCustomer(
      buildCustomerRow({ lastActivityAt: null, primaryContactName: null }),
    );

    expect(result.lastActivityAt).toBeNull();
    expect(result.primaryContactName).toBeNull();
  });

  it('derives `hasMissingData` from the tax number and postal code', () => {
    expect(
      toCustomer(buildCustomerRow({ taxNumber: null })).hasMissingData,
    ).toBe(true);
    expect(
      toCustomer(buildCustomerRow({ registeredAddressZip: null }))
        .hasMissingData,
    ).toBe(true);
  });

  it('passes the projections through instead of recomputing them', () => {
    const lastActivityAt = new Date('2020-01-01T00:00:00.000Z');

    const result = toCustomer(
      buildCustomerRow({ lastActivityAt, primaryContactName: 'Kiss Béla' }),
    );

    expect(result.lastActivityAt).toBe(lastActivityAt.toISOString());
    expect(result.primaryContactName).toBe('Kiss Béla');
  });
});

describe('toCustomerDetail', () => {
  it('maps the parent and groups the children', () => {
    const result = toCustomerDetail(buildCustomerDetailRows());

    expect(result.id).toBe(CUSTOMER_ROW_ID);
    expect(result.tags).toEqual([
      { id: buildTagRow().id, name: 'premium', isActive: true },
    ]);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]?.roles).toEqual(['primary']);
    expect(result.contacts[0]?.createdAt).toBe(
      CUSTOMER_CREATED_AT.toISOString(),
    );
    expect(result.customerUsers).toHaveLength(1);
    expect(result.customerUsers[0]?.invitedAt).toBe(
      CUSTOMER_CREATED_AT.toISOString(),
    );
  });

  it('keeps a never-logged-in user nullable', () => {
    const result = toCustomerDetail(
      buildCustomerDetailRows({
        customerUsers: [buildCustomerUserRow({ lastLoginAt: null })],
      }),
    );

    expect(result.customerUsers[0]?.lastLoginAt).toBeNull();
    expect(result.customerUsers[0]?.acceptedAt).toBe(
      CUSTOMER_CREATED_AT.toISOString(),
    );
  });

  it('renders empty children as empty arrays, never null', () => {
    const result = toCustomerDetail(
      buildCustomerDetailRows({ tags: [], contacts: [], customerUsers: [] }),
    );

    expect(result.tags).toEqual([]);
    expect(result.contacts).toEqual([]);
    expect(result.customerUsers).toEqual([]);
  });
});

describe('toContactsWithRoles', () => {
  it('groups several roles under one contact', () => {
    const contact = buildContactRow();

    const result = toContactsWithRoles([
      { contact, role: 'technical' },
      { contact, role: 'alerting' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.roles).toEqual(['technical', 'alerting']);
  });

  it('keeps a contact that has no role yet, with an empty list', () => {
    const result = toContactsWithRoles([buildContactJoinRow({ role: null })]);

    expect(result).toHaveLength(1);
    expect(result[0]?.roles).toEqual([]);
  });

  it('keeps the query order of the contacts', () => {
    const first = buildContactRow({
      id: '11111111-1111-4111-8111-111111111111',
    });
    const second = buildContactRow({
      id: '22222222-2222-4222-8222-222222222222',
    });

    const result = toContactsWithRoles([
      { contact: second, role: 'primary' },
      { contact: first, role: null },
    ]);

    expect(result.map((entry) => entry.contact.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});

describe('toNewCustomerRow', () => {
  const NOW = new Date('2026-11-22T21:00:00.000Z');

  it('fills the server-owned values and the contract defaults', () => {
    const row = toNewCustomerRow(
      buildCreateCustomerInput(),
      'AIS-202611-007',
      NOW,
    );

    expect(row.customerNumber).toBe('AIS-202611-007');
    expect(row.status).toBe('prospect');
    expect(row.registeredAddressCountry).toBe('HU');
    expect(row.statusChangedAt).toBe(NOW);
    expect(row.legalName).toBe('Új Ügyfél Kft.');
  });

  it('honours a status sent by the client', () => {
    const row = toNewCustomerRow(
      buildCreateCustomerInput({ status: 'registered' }),
      'AIS-202611-007',
      NOW,
    );

    expect(row.status).toBe('registered');
  });

  it('stores null for every omitted optional field', () => {
    const row = toNewCustomerRow(
      { type: 'sole_proprietor', legalName: 'Kiss Péter e.v.' },
      'AIS-202611-008',
      NOW,
    );

    expect(row.shortName).toBeNull();
    expect(row.taxNumber).toBeNull();
    expect(row.euVatNumber).toBeNull();
    expect(row.companyRegistrationNumber).toBeNull();
    expect(row.legalForm).toBeNull();
    expect(row.registeredAddressZip).toBeNull();
    expect(row.registeredAddressCity).toBeNull();
    expect(row.registeredAddressLine).toBeNull();
    expect(row.industry).toBeNull();
    expect(row.headcountRange).toBeNull();
    expect(row.source).toBeNull();
    expect(row.responsibleOperatorId).toBeNull();
  });
});

describe('toCustomerPatch', () => {
  it('keeps an absent field absent', () => {
    const patch = toCustomerPatch(buildUpdateCustomerInput());

    expect(patch).toEqual({ legalName: 'Példa Szolgáltató Zrt.' });
    expect('taxNumber' in patch).toBe(false);
    expect('updatedAt' in patch).toBe(false);
  });

  it('passes an explicit null through, so the column is cleared', () => {
    const patch = toCustomerPatch(
      buildUpdateCustomerInput({ taxNumber: null, industry: null }),
    );

    expect(patch.taxNumber).toBeNull();
    expect(patch.industry).toBeNull();
  });

  it('returns an empty patch when the body carried only the token', () => {
    expect(
      toCustomerPatch({ updatedAt: CUSTOMER_UPDATED_AT.toISOString() }),
    ).toEqual({});
  });
});

describe('toCreatedListRow', () => {
  it('completes a fresh row with null projections', () => {
    const row = toCreatedListRow(buildRawCustomerRow());

    expect(row.lastActivityAt).toBeNull();
    expect(row.primaryContactName).toBeNull();
    expect(row.id).toBe(CUSTOMER_ROW_ID);
  });
});

describe('toCustomerAuditPayload', () => {
  it('flattens the row with ISO timestamps and the deletion marker', () => {
    const payload = toCustomerAuditPayload(
      buildRawCustomerRow({ deletedAt: CUSTOMER_DELETED_AT }),
    );

    expect(payload['customerNumber']).toBe(CUSTOMER_NUMBER);
    expect(payload['createdAt']).toBe(CUSTOMER_CREATED_AT.toISOString());
    expect(payload['deletedAt']).toBe(CUSTOMER_DELETED_AT.toISOString());
  });

  it('keeps a live row´s deletion marker null', () => {
    expect(
      toCustomerAuditPayload(buildRawCustomerRow())['deletedAt'],
    ).toBeNull();
  });
});
