/**
 * Zod schemas of the `customers` HTTP contract (AIS-16).
 *
 * The single source of truth for every payload the resource can send or accept.
 * `packages/api-client` parses each response with these schemas at the network
 * boundary (a renamed field fails loudly at the edge instead of leaking
 * `undefined` into React), and `apps/api` validates each request with them
 * (`ZodBodyPipe` / `ZodQueryPipe`), so the two sides cannot disagree.
 *
 * Three conventions, taken from [`docs/Specs/API-Convention.md`](../../../../docs/Specs/API-Convention.md)
 * §4 and applied consistently here:
 *
 * 1. **In a response an optional field is `null`, never absent.** “No tax
 *    number” and “the server forgot the field” must stay distinguishable.
 * 2. **In a request an optional field may be omitted.** `.strict()` rejects
 *    anything the endpoint does not accept, so a client cannot believe it set a
 *    server-managed field.
 * 3. **`undefined` leaves a value alone, `null` clears it** on a `PATCH`; which
 *    is why the mutable optional fields are `.nullable().optional()`.
 *
 * Format rules are **imported**, never re-implemented (AIS-112): the Hungarian
 * tax number, the postal code, the e-mail and the E.164 phone schema already
 * exist and carry the bilingual rejection copy.
 *
 * Not in this file, on purpose: any billing, subscription or `note` field. The
 * first two belong to AIS-176, and the third does not exist — every remark about
 * a customer is an activity.
 */

import { z } from 'zod';
import { isoDateTimeSchema } from '../datetime.schema.js';
import { emailSchema } from '../common/email.schema.js';
import { huPostalCodeSchema } from '../common/hu-postal-code.schema.js';
import { huTaxNumberSchema } from '../common/hu-tax-number.schema.js';
import { phoneSchema } from '../common/phone.schema.js';
import {
  nonEmptyTextSchema,
  trimmedStringSchema,
} from '../common/text.schema.js';
import {
  ACTIVITY_AUTHOR_NAME_MAX_LENGTH,
  ACTIVITY_BODY_MAX_LENGTH,
  AUDIT_IP_ADDRESS_MAX_LENGTH,
  AUDIT_REQUEST_ID_MAX_LENGTH,
  AUDIT_USER_AGENT_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_POSITION_MAX_LENGTH,
  CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
  CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
  CUSTOMER_COUNTRY_PATTERN,
  CUSTOMER_DEFAULT_COUNTRY,
  CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH,
  CUSTOMER_INDUSTRY_MAX_LENGTH,
  CUSTOMER_INITIAL_STATUS,
  CUSTOMER_LEGAL_FORM_MAX_LENGTH,
  CUSTOMER_LEGAL_NAME_MAX_LENGTH,
  CUSTOMER_NUMBER_MAX_LENGTH,
  CUSTOMER_NUMBER_PATTERN,
  CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
  CUSTOMER_SHORT_NAME_MAX_LENGTH,
  CUSTOMER_TAG_NAME_MAX_LENGTH,
  CUSTOMER_USER_NAME_MAX_LENGTH,
} from './customers.const.js';
import {
  activityTypeSchema,
  auditOperationSchema,
  auditSourceSchema,
  authorTypeSchema,
  contactRoleSchema,
  customerSourceSchema,
  customerStatusSchema,
  customerTypeSchema,
  customerUserRoleSchema,
  customerUserStatusSchema,
  headcountRangeSchema,
} from './customers.enums.js';

/** Generated customer number, `AIS-YYYYMM-NNN`. */
export const customerNumberSchema = z
  .string()
  .trim()
  .max(CUSTOMER_NUMBER_MAX_LENGTH)
  .regex(CUSTOMER_NUMBER_PATTERN);

/** Registered-address country, ISO 3166-1 alpha-2, upper case. */
export const customerCountrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(CUSTOMER_COUNTRY_PATTERN);

/**
 * The `:id` path parameter of every single-customer route (AIS-178 `D8`).
 *
 * A malformed uuid must never reach Postgres: `'abc'::uuid` raises SQLSTATE
 * `22P02`, which the driver reports as an unknown failure and the filter turns
 * into a `500`. Validating the parameter with the **existing** generic
 * `ZodValidationPipe` makes it a `400 VALIDATION_FAILED` with the offending
 * `path`, exactly like a bad body or query does.
 *
 * Declared here (not in `apps/api`) so the OpenAPI parameter descriptor, the
 * server pipe and a future client-side pre-check share one definition.
 */
export const customerIdSchema = z.string().uuid();

/**
 * The `:contactId` path parameter of the contact routes (AIS-178, slice d).
 *
 * Same reasoning as {@link customerIdSchema}: a malformed uuid must be a `400`
 * with a field path, not a Postgres `22P02` that the filter turns into a `500`.
 */
export const contactIdSchema = z.string().uuid();

/**
 * JSON object column (`metadata`).
 *
 * `z.record(z.unknown())` instead of `z.any()`: the keys are known to be
 * strings and the values are genuinely unknown, so a consumer must narrow
 * before reading. `null` is a real state — “no details recorded”.
 */
const jsonRecordSchema = z.record(z.unknown());

/**
 * A customer as it appears in the list and as the base of the detail response.
 *
 * `lastActivityAt`, `hasMissingData` and `primaryContactName` are **derived**,
 * not stored: the first is `max(activities.created_at)`, the second is “tax
 * number or registered postal code is missing”, the third is the name of the
 * live contact carrying the `primary` role. Storing them would create a second
 * truth that drifts the moment an activity or a contact changes — see the plan
 * (AIS-14) §2.4 and AIS-17 `D9` (the list column needs the primary contact).
 */
export const customerSchema = z.object({
  id: z.string().uuid(),
  customerNumber: customerNumberSchema,
  type: customerTypeSchema,
  legalName: z.string().min(1).max(CUSTOMER_LEGAL_NAME_MAX_LENGTH),
  shortName: z.string().max(CUSTOMER_SHORT_NAME_MAX_LENGTH).nullable(),
  taxNumber: huTaxNumberSchema.nullable(),
  euVatNumber: z.string().max(CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH).nullable(),
  companyRegistrationNumber: z
    .string()
    .max(CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH)
    .nullable(),
  legalForm: z.string().max(CUSTOMER_LEGAL_FORM_MAX_LENGTH).nullable(),
  registeredAddressZip: huPostalCodeSchema.nullable(),
  registeredAddressCity: z
    .string()
    .max(CUSTOMER_ADDRESS_CITY_MAX_LENGTH)
    .nullable(),
  registeredAddressLine: z
    .string()
    .max(CUSTOMER_ADDRESS_LINE_MAX_LENGTH)
    .nullable(),
  registeredAddressCountry: customerCountrySchema,
  industry: z.string().max(CUSTOMER_INDUSTRY_MAX_LENGTH).nullable(),
  headcountRange: headcountRangeSchema.nullable(),
  source: customerSourceSchema.nullable(),
  responsibleOperatorId: z.string().uuid().nullable(),
  status: customerStatusSchema,
  statusChangedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  lastActivityAt: isoDateTimeSchema.nullable(),
  hasMissingData: z.boolean(),
  /**
   * Name of the live contact with the `primary` role; `null` when none is set.
   *
   * `null` and not `''`: “no primary contact” is a real state the admin list
   * renders as a missing-data marker (AIS-17 `D9`).
   */
  primaryContactName: z.string().nullable(),
});

/** Body of `GET /api/admin/customers` — an array, empty when nothing matches. */
export const customerListSchema = z.array(customerSchema);

/** A tag that can be attached to a customer. */
export const customerTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(CUSTOMER_TAG_NAME_MAX_LENGTH),
  isActive: z.boolean(),
});

/**
 * A contact person of a customer.
 *
 * `customerUserId` is the replacement for the mockup's “is a login user?”
 * boolean: when it is set, this contact is also a customer user, and the
 * database enforces that the user belongs to the **same** customer (composite
 * foreign key, AIS-18).
 */
export const contactSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  name: z.string().min(1).max(CONTACT_NAME_MAX_LENGTH),
  position: z.string().max(CONTACT_POSITION_MAX_LENGTH).nullable(),
  email: emailSchema.nullable(),
  phone: phoneSchema.nullable(),
  customerUserId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  roles: z.array(contactRoleSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/**
 * Body of `GET /api/admin/customers/:id/contacts`.
 *
 * An array and never `null`: "no contacts" is an empty list (API-Convention §4).
 * The rows are the same `contactSchema` the detail response publishes, so a
 * consumer parses one shape for both reads.
 */
export const contactListSchema = z.array(contactSchema);

/** A login user that belongs to exactly one customer. */
export const customerUserSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  name: z.string().min(1).max(CUSTOMER_USER_NAME_MAX_LENGTH),
  email: emailSchema,
  role: customerUserRoleSchema,
  status: customerUserStatusSchema,
  invitedByOperatorId: z.string().uuid().nullable(),
  invitedAt: isoDateTimeSchema.nullable(),
  acceptedAt: isoDateTimeSchema.nullable(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/**
 * Body of `GET /api/admin/customers/:id`.
 *
 * The detail response carries the children the UI needs in one round trip. They
 * are arrays and never `null`: “no contacts” is an empty list, not a missing
 * field (API-Convention §4).
 */
export const customerDetailSchema = customerSchema.extend({
  tags: z.array(customerTagSchema),
  contacts: z.array(contactSchema),
  customerUsers: z.array(customerUserSchema),
});

/**
 * One entry of the activity feed.
 *
 * Exactly one author reference is filled: `operatorId` for staff,
 * `customerUserId` for a customer user, neither for `system`. `authorName` is a
 * snapshot so the entry stays readable after the author is deactivated.
 */
export const activitySchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  type: activityTypeSchema,
  body: z.string().min(1).max(ACTIVITY_BODY_MAX_LENGTH),
  authorType: authorTypeSchema,
  operatorId: z.string().uuid().nullable(),
  customerUserId: z.string().uuid().nullable(),
  authorName: z.string().min(1).max(ACTIVITY_AUTHOR_NAME_MAX_LENGTH),
  metadata: jsonRecordSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema.nullable(),
});

/**
 * One entry of the audit log — **read-only by construction**.
 *
 * There is no request schema for it: the table is written by `AuditWriter` only
 * and accepts no `UPDATE`/`DELETE` (AIS-177). `customerId` is nullable because
 * anonymisation clears the reference; `beforeData`/`afterData` carry only the
 * changed keys.
 */
export const auditLogSchema = z.object({
  id: z.number().int().nonnegative(),
  customerId: z.string().uuid().nullable(),
  tableName: z.string().min(1),
  recordId: z.string().uuid().nullable(),
  operation: auditOperationSchema,
  beforeData: jsonRecordSchema.nullable(),
  afterData: jsonRecordSchema.nullable(),
  actorType: authorTypeSchema,
  actorId: z.string().uuid().nullable(),
  actorName: z.string().min(1),
  occurredAt: isoDateTimeSchema,
  ipAddress: z.string().max(AUDIT_IP_ADDRESS_MAX_LENGTH).nullable(),
  userAgent: z.string().max(AUDIT_USER_AGENT_MAX_LENGTH).nullable(),
  requestId: z.string().max(AUDIT_REQUEST_ID_MAX_LENGTH).nullable(),
  source: auditSourceSchema.nullable(),
});

/**
 * Body of `POST /api/admin/customers`.
 *
 * `legalName` and `type` are the only required fields (AIS-16 decision `D1`):
 * an operator must be able to register a prospect before the tax number or the
 * full address is known — that is exactly what `hasMissingData` flags later.
 *
 * `customerNumber`, `statusChangedAt` and the timestamps are **server-managed**
 * and therefore rejected by `.strict()`.
 */
export const createCustomerSchema = z
  .object({
    type: customerTypeSchema,
    legalName: nonEmptyTextSchema({ max: CUSTOMER_LEGAL_NAME_MAX_LENGTH }),
    shortName: trimmedStringSchema({
      max: CUSTOMER_SHORT_NAME_MAX_LENGTH,
    }).optional(),
    taxNumber: huTaxNumberSchema.optional(),
    euVatNumber: trimmedStringSchema({
      max: CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH,
    }).optional(),
    companyRegistrationNumber: trimmedStringSchema({
      max: CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
    }).optional(),
    legalForm: trimmedStringSchema({
      max: CUSTOMER_LEGAL_FORM_MAX_LENGTH,
    }).optional(),
    registeredAddressZip: huPostalCodeSchema.optional(),
    registeredAddressCity: trimmedStringSchema({
      max: CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
    }).optional(),
    registeredAddressLine: trimmedStringSchema({
      max: CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
    }).optional(),
    registeredAddressCountry: customerCountrySchema.default(
      CUSTOMER_DEFAULT_COUNTRY,
    ),
    industry: trimmedStringSchema({ max: CUSTOMER_INDUSTRY_MAX_LENGTH }).optional(),
    headcountRange: headcountRangeSchema.optional(),
    source: customerSourceSchema.optional(),
    responsibleOperatorId: z.string().uuid().optional(),
    status: customerStatusSchema.default(CUSTOMER_INITIAL_STATUS),
  })
  .strict();

/**
 * Body of `PATCH /api/admin/customers/:id`.
 *
 * `updatedAt` is required and is **never written**: it is the optimistic
 * concurrency token the server compares against the stored row (the same
 * convention `api-keys.update.ts` established in AIS-108). A stale token is a
 * `409 STALE_WRITE`, not a silent overwrite.
 */
export const updateCustomerSchema = z
  .object({
    type: customerTypeSchema.optional(),
    legalName: nonEmptyTextSchema({
      max: CUSTOMER_LEGAL_NAME_MAX_LENGTH,
    }).optional(),
    shortName: trimmedStringSchema({
      max: CUSTOMER_SHORT_NAME_MAX_LENGTH,
    })
      .nullable()
      .optional(),
    taxNumber: huTaxNumberSchema.nullable().optional(),
    euVatNumber: trimmedStringSchema({
      max: CUSTOMER_EU_VAT_NUMBER_MAX_LENGTH,
    })
      .nullable()
      .optional(),
    companyRegistrationNumber: trimmedStringSchema({
      max: CUSTOMER_REGISTRATION_NUMBER_MAX_LENGTH,
    })
      .nullable()
      .optional(),
    legalForm: trimmedStringSchema({ max: CUSTOMER_LEGAL_FORM_MAX_LENGTH })
      .nullable()
      .optional(),
    registeredAddressZip: huPostalCodeSchema.nullable().optional(),
    registeredAddressCity: trimmedStringSchema({
      max: CUSTOMER_ADDRESS_CITY_MAX_LENGTH,
    })
      .nullable()
      .optional(),
    registeredAddressLine: trimmedStringSchema({
      max: CUSTOMER_ADDRESS_LINE_MAX_LENGTH,
    })
      .nullable()
      .optional(),
    registeredAddressCountry: customerCountrySchema.optional(),
    industry: trimmedStringSchema({ max: CUSTOMER_INDUSTRY_MAX_LENGTH })
      .nullable()
      .optional(),
    headcountRange: headcountRangeSchema.nullable().optional(),
    source: customerSourceSchema.nullable().optional(),
    responsibleOperatorId: z.string().uuid().nullable().optional(),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

/**
 * Field names a customer `PATCH` must **not** accept.
 *
 * Documentation constant, like `API_KEY_UPDATE_FORBIDDEN_FIELDS`: `.strict()`
 * already rejects them, but a reader should not have to derive the intent from a
 * `400`. `status` is excluded because it has its own endpoint — a status change
 * must also set `status_changed_at`, and that is a decision the service makes.
 */
export const CUSTOMER_UPDATE_FORBIDDEN_FIELDS = [
  'id',
  'customerNumber',
  'status',
  'statusChangedAt',
  'createdAt',
  'deletedAt',
] as const;

/**
 * Body of `PATCH /api/admin/customers/:id/status`.
 *
 * A separate endpoint because a status change is not a field edit: it writes
 * `status_changed_at` and is recorded as its own audit operation.
 */
export const updateCustomerStatusSchema = z
  .object({
    status: customerStatusSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

/**
 * Body of `POST /api/admin/customers/:id/activities`.
 *
 * The author is **not** part of the body: it comes from the request context
 * (AIS-177 `AuditActorProvider`), so a client cannot write an entry in someone
 * else's name.
 */
export const createActivitySchema = z
  .object({
    type: activityTypeSchema,
    body: nonEmptyTextSchema({ max: ACTIVITY_BODY_MAX_LENGTH }),
    metadata: jsonRecordSchema.optional(),
  })
  .strict();

/** Body of `PATCH /api/admin/customers/:id/activities/:activityId`. */
export const updateActivitySchema = z
  .object({
    body: nonEmptyTextSchema({ max: ACTIVITY_BODY_MAX_LENGTH }).optional(),
    metadata: jsonRecordSchema.nullable().optional(),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

/**
 * Body of `POST /api/admin/customers/:id/contacts`.
 *
 * `roles` defaults to an empty list: a contact without a role is valid, and the
 * `primary` uniqueness rule is enforced by the database, not here.
 */
export const createContactSchema = z
  .object({
    name: nonEmptyTextSchema({ max: CONTACT_NAME_MAX_LENGTH }),
    position: trimmedStringSchema({ max: CONTACT_POSITION_MAX_LENGTH }).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    customerUserId: z.string().uuid().optional(),
    roles: z.array(contactRoleSchema).optional(),
  })
  .strict();

/** Body of `PATCH /api/admin/customers/:id/contacts/:contactId`. */
export const updateContactSchema = z
  .object({
    name: nonEmptyTextSchema({ max: CONTACT_NAME_MAX_LENGTH }).optional(),
    position: trimmedStringSchema({ max: CONTACT_POSITION_MAX_LENGTH })
      .nullable()
      .optional(),
    email: emailSchema.nullable().optional(),
    phone: phoneSchema.nullable().optional(),
    customerUserId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    roles: z.array(contactRoleSchema).optional(),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

/**
 * Body of `POST /api/admin/customers/:id/customer-users` — an invitation.
 *
 * The created user starts in `invited` state; accepting the invitation is the
 * auth story's job, so `status` is not part of this body.
 */
export const inviteCustomerUserSchema = z
  .object({
    name: nonEmptyTextSchema({ max: CUSTOMER_USER_NAME_MAX_LENGTH }),
    email: emailSchema,
    role: customerUserRoleSchema.default('member'),
  })
  .strict();

/** Body of `POST /api/admin/customers/:id/tags` — create a tag and attach it. */
export const createCustomerTagSchema = z
  .object({
    name: nonEmptyTextSchema({ max: CUSTOMER_TAG_NAME_MAX_LENGTH }),
  })
  .strict();

/** Body of `PATCH /api/admin/customers/:id/tags` — attach an existing tag. */
export const attachCustomerTagSchema = z
  .object({
    tagId: z.string().uuid(),
  })
  .strict();
