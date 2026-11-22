/**
 * Types of the `customers` contract, derived from the zod schemas (AIS-16).
 *
 * Derived rather than hand-written, for the same reason `api-keys.interface.ts`
 * is: a schema change must not be able to drift away from the type. Consumers
 * (`packages/api-client`, the admin feature) import these aliases and never
 * `z.infer` at the call site.
 *
 * Two input types use `z.input` instead of `z.infer`, and that is deliberate:
 * `createCustomerSchema` and `inviteCustomerUserSchema` carry **defaults**
 * (`registeredAddressCountry`, `status`, `role`). A caller may omit those
 * fields, so the type a caller sees must be the *input* type; the parsed
 * *output* type would force every caller to repeat the defaults, which is the
 * opposite of having them in the contract.
 */

import type { z } from 'zod';
import type {
  activitySchema,
  attachCustomerTagSchema,
  auditLogSchema,
  contactSchema,
  createActivitySchema,
  createContactSchema,
  createCustomerSchema,
  createCustomerTagSchema,
  customerDetailSchema,
  customerSchema,
  customerTagSchema,
  customerUserSchema,
  inviteCustomerUserSchema,
  updateActivitySchema,
  updateContactSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
} from './customers.schema.js';

/** A customer row as returned by the list and as the base of the detail view. */
export type Customer = z.infer<typeof customerSchema>;

/** A customer with its tags, contacts and login users — `GET /:id`. */
export type CustomerDetail = z.infer<typeof customerDetailSchema>;

/** A tag attachable to a customer. */
export type CustomerTag = z.infer<typeof customerTagSchema>;

/** A contact person of a customer. */
export type Contact = z.infer<typeof contactSchema>;

/** A login user that belongs to one customer. */
export type CustomerUser = z.infer<typeof customerUserSchema>;

/** One entry of the activity feed. */
export type Activity = z.infer<typeof activitySchema>;

/** One entry of the read-only audit log. */
export type AuditLog = z.infer<typeof auditLogSchema>;

/** Caller-side body of `POST /api/admin/customers` (country and status optional). */
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;

/** Body of `PATCH /api/admin/customers/:id`. */
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/** Body of `PATCH /api/admin/customers/:id/status`. */
export type UpdateCustomerStatusInput = z.infer<typeof updateCustomerStatusSchema>;

/** Body of `POST /api/admin/customers/:id/activities`. */
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

/** Body of `PATCH /api/admin/customers/:id/activities/:activityId`. */
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

/** Body of `POST /api/admin/customers/:id/contacts`. */
export type CreateContactInput = z.infer<typeof createContactSchema>;

/** Body of `PATCH /api/admin/customers/:id/contacts/:contactId`. */
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

/** Caller-side body of `POST /api/admin/customers/:id/customer-users`. */
export type InviteCustomerUserInput = z.input<typeof inviteCustomerUserSchema>;

/** Body of `POST /api/admin/customers/:id/tags`. */
export type CreateCustomerTagInput = z.infer<typeof createCustomerTagSchema>;

/** Body of `PATCH /api/admin/customers/:id/tags`. */
export type AttachCustomerTagInput = z.infer<typeof attachCustomerTagSchema>;
