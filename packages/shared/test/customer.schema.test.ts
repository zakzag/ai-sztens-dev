import {
  CUSTOMER_DEFAULT_COUNTRY,
  CUSTOMER_INITIAL_STATUS,
  VALID_ACTIVITY,
  VALID_AUDIT_LOG,
  VALID_CONTACT,
  VALID_CREATE_CUSTOMER_REQUEST,
  VALID_CUSTOMER,
  VALID_CUSTOMER_DETAIL,
  VALID_CUSTOMER_LIST,
  VALID_UPDATE_CUSTOMER_REQUEST,
  VALIDATION_MESSAGE_CATALOGUE,
  activitySchema,
  auditLogSchema,
  contactSchema,
  createActivitySchema,
  createContactSchema,
  createCustomerSchema,
  customerDetailSchema,
  customerListSchema,
  customerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
} from '../src/index.js';
import { firstMessage, parsedValue } from './lib/validation.helper.js';

/**
 * Unit tests of the `customers` contract schemas (AIS-16).
 *
 * Three blocks, mirroring the three rules the schemas exist for:
 *
 * 1. **read shapes** — an optional field is `null`, never absent, and the
 *    derived fields (`lastActivityAt`, `hasMissingData`) are booleans/dates a
 *    client can rely on;
 * 2. **create/update** — the request is `.strict()`, defaults are part of the
 *    contract, and `updatedAt` is a mandatory concurrency token;
 * 3. **format reuse** — the tax number, phone and e-mail rules come from AIS-112
 *    and produce the shared copy, which is what proves the schemas are not
 *    re-implementing them.
 */

const ENGLISH = VALIDATION_MESSAGE_CATALOGUE.en;

describe('customerSchema', () => {
  it('parses a fully filled customer', () => {
    expect(customerSchema.safeParse(VALID_CUSTOMER).success).toBe(true);
  });

  it('parses the sparse branch with null optional fields', () => {
    const sparse = parsedValue(customerSchema, {
      ...VALID_CUSTOMER,
      shortName: null,
      taxNumber: null,
      lastActivityAt: null,
      hasMissingData: true,
    });

    expect(sparse?.taxNumber).toBeNull();
    expect(sparse?.hasMissingData).toBe(true);
  });

  it('rejects a response that omits an optional field instead of nulling it', () => {
    const withoutShortName: Record<string, unknown> = { ...VALID_CUSTOMER };
    delete withoutShortName.shortName;

    expect(customerSchema.safeParse(withoutShortName).success).toBe(false);
  });

  it('rejects an unknown status value', () => {
    expect(
      customerSchema.safeParse({ ...VALID_CUSTOMER, status: 'archived' }).success,
    ).toBe(false);
  });

  it('rejects an unknown customer type', () => {
    expect(
      customerSchema.safeParse({ ...VALID_CUSTOMER, type: 'individual' }).success,
    ).toBe(false);
  });

  it('requires a generated customer number', () => {
    expect(
      customerSchema.safeParse({ ...VALID_CUSTOMER, customerNumber: '' }).success,
    ).toBe(false);
  });

  it('parses the list payload', () => {
    expect(customerListSchema.safeParse(VALID_CUSTOMER_LIST).success).toBe(true);
  });
});

describe('customerDetailSchema', () => {
  it('parses tags, contacts and customer users', () => {
    const detail = parsedValue(customerDetailSchema, VALID_CUSTOMER_DETAIL);

    expect(detail?.tags).toHaveLength(1);
    expect(detail?.contacts).toHaveLength(2);
    expect(detail?.customerUsers).toHaveLength(1);
  });

  it('rejects null children — an empty relation is an empty array', () => {
    expect(
      customerDetailSchema.safeParse({
        ...VALID_CUSTOMER_DETAIL,
        contacts: null,
      }).success,
    ).toBe(false);
  });
});

describe('contactSchema', () => {
  it('parses a contact with roles', () => {
    const contact = parsedValue(contactSchema, VALID_CONTACT);

    expect(contact?.roles).toEqual(['primary']);
    expect(contact?.phone).toBe('+36301234567');
  });

  it('rejects an unknown role', () => {
    expect(
      contactSchema.safeParse({ ...VALID_CONTACT, roles: ['billing'] }).success,
    ).toBe(false);
  });
});

describe('auditLogSchema', () => {
  it('parses an insert row with a partial diff', () => {
    const entry = parsedValue(auditLogSchema, VALID_AUDIT_LOG);

    expect(entry?.beforeData).toBeNull();
    expect(entry?.afterData).toEqual(VALID_AUDIT_LOG.afterData);
  });

  it('rejects a negative id', () => {
    expect(
      auditLogSchema.safeParse({ ...VALID_AUDIT_LOG, id: -1 }).success,
    ).toBe(false);
  });

  it('rejects an unknown operation', () => {
    expect(
      auditLogSchema.safeParse({ ...VALID_AUDIT_LOG, operation: 'truncate' })
        .success,
    ).toBe(false);
  });
});

describe('activitySchema', () => {
  it('parses an operator note', () => {
    const activity = parsedValue(activitySchema, VALID_ACTIVITY);

    expect(activity?.authorType).toBe('operator');
    expect(activity?.customerUserId).toBeNull();
  });

  it('rejects an activity without a body', () => {
    expect(
      activitySchema.safeParse({ ...VALID_ACTIVITY, body: '' }).success,
    ).toBe(false);
  });
});

describe('createCustomerSchema', () => {
  it('accepts the minimal body and fills the contract defaults', () => {
    const created = parsedValue(createCustomerSchema, {
      type: 'company',
      legalName: 'Minimál Kft.',
    });

    expect(created?.registeredAddressCountry).toBe(CUSTOMER_DEFAULT_COUNTRY);
    expect(created?.status).toBe(CUSTOMER_INITIAL_STATUS);
  });

  it('accepts the full sample body', () => {
    expect(
      createCustomerSchema.safeParse(VALID_CREATE_CUSTOMER_REQUEST).success,
    ).toBe(true);
  });

  it('rejects a whitespace-only legal name with the required copy', () => {
    expect(
      firstMessage(createCustomerSchema, { type: 'company', legalName: '   ' }),
    ).toBe(ENGLISH.REQUIRED);
  });

  it('rejects a tax number with a wrong check digit', () => {
    expect(
      firstMessage(createCustomerSchema, {
        ...VALID_CREATE_CUSTOMER_REQUEST,
        taxNumber: '10773382-2-44',
      }),
    ).toBe(ENGLISH.TAX_NUMBER_CHECKSUM);
  });

  it('rejects a non-Hungarian postal code', () => {
    expect(
      firstMessage(createCustomerSchema, {
        ...VALID_CREATE_CUSTOMER_REQUEST,
        registeredAddressZip: '123',
      }),
    ).toBe(ENGLISH.POSTAL_CODE);
  });

  it('rejects a server-managed field instead of silently dropping it', () => {
    expect(
      createCustomerSchema.safeParse({
        ...VALID_CREATE_CUSTOMER_REQUEST,
        customerNumber: 'AIS-202611-003',
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown key', () => {
    expect(
      createCustomerSchema.safeParse({
        ...VALID_CREATE_CUSTOMER_REQUEST,
        note: 'Cég-szintű megjegyzés',
      }).success,
    ).toBe(false);
  });
});

describe('updateCustomerSchema', () => {
  it('accepts a single changed field with the concurrency token', () => {
    expect(
      updateCustomerSchema.safeParse(VALID_UPDATE_CUSTOMER_REQUEST).success,
    ).toBe(true);
  });

  it('requires updatedAt', () => {
    expect(firstMessage(updateCustomerSchema, { shortName: 'Új név' })).not.toBe(
      null,
    );
  });

  it('accepts null to clear an optional field', () => {
    const patch = parsedValue(updateCustomerSchema, {
      taxNumber: null,
      updatedAt: VALID_CUSTOMER.updatedAt,
    });

    expect(patch?.taxNumber).toBeNull();
  });

  it('rejects the status field — it has its own endpoint', () => {
    expect(
      updateCustomerSchema.safeParse({
        ...VALID_UPDATE_CUSTOMER_REQUEST,
        status: 'suspended',
      }).success,
    ).toBe(false);
  });

  it('rejects the customer number', () => {
    expect(
      updateCustomerSchema.safeParse({
        ...VALID_UPDATE_CUSTOMER_REQUEST,
        customerNumber: 'AIS-202611-009',
      }).success,
    ).toBe(false);
  });
});

describe('updateCustomerStatusSchema', () => {
  it('accepts a status change with the concurrency token', () => {
    expect(
      updateCustomerStatusSchema.safeParse({
        status: 'suspended',
        updatedAt: VALID_CUSTOMER.updatedAt,
      }).success,
    ).toBe(true);
  });

  it('rejects a body without the concurrency token', () => {
    expect(
      updateCustomerStatusSchema.safeParse({ status: 'suspended' }).success,
    ).toBe(false);
  });
});

describe('createActivitySchema', () => {
  it('accepts a note with metadata', () => {
    expect(
      createActivitySchema.safeParse({
        type: 'note',
        body: 'Telefonon egyeztettünk.',
        metadata: { durationSeconds: 120 },
      }).success,
    ).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(
      firstMessage(createActivitySchema, { type: 'note', body: '   ' }),
    ).toBe(ENGLISH.REQUIRED);
  });

  it('rejects an author field — the author comes from the request context', () => {
    expect(
      createActivitySchema.safeParse({
        type: 'note',
        body: 'Szöveg',
        authorName: 'Valaki',
      }).success,
    ).toBe(false);
  });
});

describe('createContactSchema', () => {
  it('normalises the phone to E.164 and lower-cases the e-mail', () => {
    const contact = parsedValue(createContactSchema, {
      name: 'Nagy Anna',
      email: '  Anna.Nagy@PELDA.hu ',
      phone: '06-30-123-4567',
      roles: ['primary'],
    });

    expect(contact?.phone).toBe('+36301234567');
    expect(contact?.email).toBe('anna.nagy@pelda.hu');
  });

  it('rejects an unparseable phone number', () => {
    expect(
      firstMessage(createContactSchema, {
        name: 'Nagy Anna',
        phone: 'nem telefonszám',
      }),
    ).toBe(ENGLISH.PHONE);
  });

  it('requires a contact name', () => {
    expect(firstMessage(createContactSchema, { position: 'Ügyvezető' })).toBe(
      ENGLISH.REQUIRED,
    );
  });
});
