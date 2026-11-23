/**
 * Sample payloads of the `customers` contract (AIS-16, following the
 * `api-keys.fixture.ts` pattern from AIS-98).
 *
 * One value, several consumers: the registry entries publish these objects as
 * the `example` of their success responses, the shared schema tests parse the
 * very same objects, and the admin tests use them as MSW handlers' payloads.
 * Writing a second sample somewhere else would let the documented example drift
 * away from the schema it illustrates.
 *
 * Typed values, not schemas: if a schema gains a field, the compile error
 * appears here instead of in the generated document.
 *
 * The tax number is a real, checksum-valid Hungarian number from the AIS-112
 * test suite (`10773381-2-44`), because `huTaxNumberSchema` verifies the check
 * digit — a made-up number would make these fixtures unusable.
 */

import type {
  Activity,
  AuditLog,
  Contact,
  CreateCustomerInput,
  Customer,
  CustomerDetail,
  CustomerTag,
  CustomerUser,
  UpdateCustomerInput,
} from './customers.interface.js';

/** A fully filled customer; every optional field is present. */
export const VALID_CUSTOMER: Customer = {
  id: '0d9f3a2e-6b41-4c8a-9f2d-7c5e1a3b4d60',
  customerNumber: 'AIS-202611-001',
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
  statusChangedAt: '2026-11-15T09:00:00.000Z',
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-15T09:00:00.000Z',
  lastActivityAt: '2026-11-17T14:30:00.000Z',
  hasMissingData: false,
  // Derived from {@link VALID_CONTACT}'s `primary` role (AIS-178 `D4`).
  primaryContactName: 'Nagy Anna',
};

/**
 * The other branch: a prospect whose tax number and postal code are unknown.
 *
 * `hasMissingData` is `true` exactly because of that, and `lastActivityAt` is
 * `null` because nothing has been recorded yet — the two empty-value cases the
 * admin list must render.
 */
export const SECOND_CUSTOMER: Customer = {
  id: '4f5e6d7c-8b9a-4c1d-9e2f-3a4b5c6d7e8f',
  customerNumber: 'AIS-202611-002',
  type: 'sole_proprietor',
  legalName: 'Kiss Péter egyéni vállalkozó',
  shortName: null,
  taxNumber: null,
  euVatNumber: null,
  companyRegistrationNumber: null,
  legalForm: null,
  registeredAddressZip: null,
  registeredAddressCity: null,
  registeredAddressLine: null,
  registeredAddressCountry: 'HU',
  industry: null,
  headcountRange: 'sole',
  source: 'referral',
  responsibleOperatorId: null,
  status: 'prospect',
  statusChangedAt: '2026-11-18T10:15:00.000Z',
  createdAt: '2026-11-18T10:15:00.000Z',
  updatedAt: '2026-11-18T10:15:00.000Z',
  lastActivityAt: null,
  hasMissingData: true,
  // No contact at all yet — the “no primary contact” state (AIS-17 `D9`).
  primaryContactName: null,
};

/** Payload example of `GET /api/admin/customers` (a two-element list). */
export const VALID_CUSTOMER_LIST: readonly Customer[] = [
  VALID_CUSTOMER,
  SECOND_CUSTOMER,
];

/** A tag attachable to a customer. */
export const VALID_CUSTOMER_TAG: CustomerTag = {
  id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  name: 'premium',
  isActive: true,
};

/** The primary contact of {@link VALID_CUSTOMER}. */
export const VALID_CONTACT: Contact = {
  id: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
  customerId: VALID_CUSTOMER.id,
  name: 'Nagy Anna',
  position: 'Ügyvezető',
  email: 'anna.nagy@pelda.hu',
  phone: '+36301234567',
  customerUserId: null,
  isActive: true,
  roles: ['primary'],
  createdAt: '2026-11-01T08:30:00.000Z',
  updatedAt: '2026-11-01T08:30:00.000Z',
};

/** A contact that is also a login user — the `customerUserId` branch. */
export const SECOND_CONTACT: Contact = {
  id: 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f60',
  customerId: VALID_CUSTOMER.id,
  name: 'Tóth Béla',
  position: 'IT vezető',
  email: 'bela.toth@pelda.hu',
  phone: '+36309876543',
  customerUserId: 'e3f4a5b6-c7d8-4e9f-8a0b-1c2d3e4f5a60',
  isActive: true,
  roles: ['technical', 'alerting'],
  createdAt: '2026-11-02T09:00:00.000Z',
  updatedAt: '2026-11-02T09:00:00.000Z',
};

/** The `owner` login user of {@link VALID_CUSTOMER}. */
export const VALID_CUSTOMER_USER: CustomerUser = {
  id: 'e3f4a5b6-c7d8-4e9f-8a0b-1c2d3e4f5a60',
  customerId: VALID_CUSTOMER.id,
  name: 'Nagy Anna',
  email: 'anna.nagy@pelda.hu',
  role: 'owner',
  status: 'active',
  invitedByOperatorId: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
  invitedAt: '2026-11-01T09:00:00.000Z',
  acceptedAt: '2026-11-01T09:20:00.000Z',
  lastLoginAt: '2026-11-17T07:45:00.000Z',
  createdAt: '2026-11-01T09:00:00.000Z',
  updatedAt: '2026-11-17T07:45:00.000Z',
};

/**
 * A user that has only been invited — the pending branch.
 *
 * `acceptedAt` and `lastLoginAt` are `null`, which is how “invited but not
 * active yet” is expressed. `customerId` points at {@link SECOND_CUSTOMER}, so
 * the pair also proves that user lists are scoped per customer.
 */
export const INVITED_CUSTOMER_USER: CustomerUser = {
  id: 'f4a5b6c7-d8e9-4f0a-8b1c-2d3e4f5a6b70',
  customerId: SECOND_CUSTOMER.id,
  name: 'Kiss Péter',
  email: 'peter.kiss@pelda.hu',
  role: 'owner',
  status: 'invited',
  invitedByOperatorId: null,
  invitedAt: '2026-11-18T10:20:00.000Z',
  acceptedAt: null,
  lastLoginAt: null,
  createdAt: '2026-11-18T10:20:00.000Z',
  updatedAt: '2026-11-18T10:20:00.000Z',
};

/** The detail payload of {@link VALID_CUSTOMER}. */
export const VALID_CUSTOMER_DETAIL: CustomerDetail = {
  ...VALID_CUSTOMER,
  tags: [VALID_CUSTOMER_TAG],
  contacts: [VALID_CONTACT, SECOND_CONTACT],
  customerUsers: [VALID_CUSTOMER_USER],
};

/** An operator-written note — the default activity kind. */
export const VALID_ACTIVITY: Activity = {
  id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c50',
  customerId: VALID_CUSTOMER.id,
  type: 'note',
  body: 'Telefonon egyeztettünk a bevezetés ütemezéséről.',
  authorType: 'operator',
  operatorId: 'b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e',
  customerUserId: null,
  authorName: 'Kálmán Rák',
  metadata: null,
  createdAt: '2026-11-17T14:30:00.000Z',
  updatedAt: null,
};

/** A system entry with metadata — the machine-author branch. */
export const SYSTEM_ACTIVITY: Activity = {
  id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d60',
  customerId: VALID_CUSTOMER.id,
  type: 'status_change',
  body: 'Státusz: próbaidőszak -> aktív.',
  authorType: 'system',
  operatorId: null,
  customerUserId: null,
  authorName: 'system',
  metadata: { from: 'trial', to: 'active' },
  createdAt: '2026-11-15T09:00:00.000Z',
  updatedAt: null,
};

/** The audit row that the creation of {@link VALID_CUSTOMER} produces. */
export const VALID_AUDIT_LOG: AuditLog = {
  id: 1,
  customerId: VALID_CUSTOMER.id,
  tableName: 'customers',
  recordId: VALID_CUSTOMER.id,
  operation: 'insert',
  beforeData: null,
  afterData: {
    customerNumber: VALID_CUSTOMER.customerNumber,
    type: VALID_CUSTOMER.type,
    legalName: VALID_CUSTOMER.legalName,
    status: VALID_CUSTOMER.status,
  },
  actorType: 'system',
  actorId: null,
  actorName: 'system',
  occurredAt: '2026-11-01T08:00:00.000Z',
  ipAddress: null,
  userAgent: null,
  requestId: '7c1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b',
  source: 'admin_api',
};

/**
 * A valid `POST /api/admin/customers` body.
 *
 * `registeredAddressCountry` and `status` are **omitted on purpose**: they carry
 * defaults in the schema, and this fixture is the proof that a caller may rely
 * on them.
 */
export const VALID_CREATE_CUSTOMER_REQUEST: CreateCustomerInput = {
  type: 'company',
  legalName: 'Új Ügyfél Kft.',
  shortName: 'Új Ügyfél',
  taxNumber: '10537914-4-44',
  registeredAddressZip: '4024',
  registeredAddressCity: 'Debrecen',
  registeredAddressLine: 'Piac utca 20.',
  headcountRange: '6_20',
  source: 'manual',
};

/** A valid `PATCH /api/admin/customers/:id` body (one changed field). */
export const VALID_UPDATE_CUSTOMER_REQUEST: UpdateCustomerInput = {
  shortName: 'Példa Kft. (új)',
  updatedAt: VALID_CUSTOMER.updatedAt,
};
