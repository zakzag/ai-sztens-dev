/**
 * Pure mapping of the contact aggregate (AIS-178, slice d).
 *
 * Row → wire payload, request body → insert/update payload, and row → the record
 * the audit diff compares. No I/O, no Nest, no Drizzle query building: every
 * branch (`null` vs. `undefined`, `Date` vs. string, a role set that did not
 * change) is trivial to unit test.
 *
 * The output types come from `@callback/shared` (`Contact`), so this module can
 * only ever *produce* the contract shape, never a second copy of it.
 */

import type {
  Contact,
  ContactRole,
  CreateContactInput,
  UpdateContactInput,
} from '@callback/shared';
import type {
  ContactRoleRow,
  ContactRow,
  NewContactRoleRow,
  NewContactRow,
} from '../db/schema.js';
import { toIsoString } from '../common/date/iso-date.js';
import type { ContactWithRoles } from './customers.interface.js';
import type { ContactPatch } from './customers-contacts.interface.js';

/**
 * Maps a contact row (with its roles) to the wire payload.
 *
 * `roles` is copied, not passed by reference: the repository's grouping array is
 * mutable, and a caller must not be able to change a payload after it was built.
 *
 * @param entry - the contact row plus the roles it holds.
 * @returns the `Contact` payload with ISO 8601 timestamps.
 */
export function toContact(entry: ContactWithRoles): Contact {
  return {
    id: entry.contact.id,
    customerId: entry.contact.customerId,
    name: entry.contact.name,
    position: entry.contact.position,
    email: entry.contact.email,
    phone: entry.contact.phone,
    customerUserId: entry.contact.customerUserId,
    isActive: entry.contact.isActive,
    roles: [...entry.roles],
    createdAt: toIsoString(entry.contact.createdAt),
    updatedAt: toIsoString(entry.contact.updatedAt),
  };
}

/**
 * Maps a validated `POST …/contacts` body to an insert payload.
 *
 * `customerId` comes from the path, never from the body (`.strict()` rejects it
 * anyway), and `isActive` starts `true`: a contact the operator just added is
 * active by definition, and deactivating it is an explicit edit.
 *
 * @param customerId - the parent customer from the route.
 * @param input - validated body.
 * @returns insert payload for `customer.contacts`.
 */
export function toNewContactRow(
  customerId: string,
  input: CreateContactInput,
): NewContactRow {
  return {
    customerId,
    name: input.name,
    position: input.position ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    customerUserId: input.customerUserId ?? null,
    isActive: true,
  };
}

/**
 * Maps a validated `PATCH …/contacts/:contactId` body to the column subset.
 *
 * `undefined` leaves a column alone, `null` clears it — the same rule the
 * customer patch follows. `roles` and `updatedAt` are **not** part of the patch:
 * the first is written through `contact_roles`, the second is only compared.
 *
 * @param input - validated body.
 * @returns the columns to write; possibly empty.
 */
export function toContactPatch(input: UpdateContactInput): ContactPatch {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.position === undefined ? {} : { position: input.position }),
    ...(input.email === undefined ? {} : { email: input.email }),
    ...(input.phone === undefined ? {} : { phone: input.phone }),
    ...(input.customerUserId === undefined
      ? {}
      : { customerUserId: input.customerUserId }),
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
  };
}

/**
 * @param patch - the column subset built by {@link toContactPatch}.
 * @returns `true` when the request carried no contact field at all.
 */
export function hasContactPatch(patch: ContactPatch): boolean {
  return Object.keys(patch).length > 0;
}

/**
 * Builds the `contact_roles` rows of one role set.
 *
 * `customer_id` is denormalised into every row on purpose (AIS-18): it is what
 * lets the partial unique index enforce "one primary per customer" without a
 * trigger, and the composite foreign key keeps it honest.
 *
 * @param contactId - the contact the roles belong to.
 * @param customerId - its customer.
 * @param roles - the role set to write.
 * @returns one insert payload per role.
 */
export function toRoleRows(
  contactId: string,
  customerId: string,
  roles: readonly ContactRole[],
): readonly NewContactRoleRow[] {
  return roles.map((role) => ({ contactId, customerId, role }));
}

/**
 * @param left - one role set.
 * @param right - another role set.
 * @returns `true` when both hold exactly the same roles (order-insensitive).
 */
export function isSameRoleSet(
  left: readonly ContactRole[],
  right: readonly ContactRole[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftSet = new Set(left);

  return right.every((role) => leftSet.has(role));
}

/**
 * Groups a contact page and its role rows under the contacts they belong to.
 *
 * The page query and the role query are separate on purpose: a `LEFT JOIN` with
 * `LIMIT` would cut a contact's role rows off at the page boundary (Postgres
 * limits **joined rows**, not contacts), so the roles are read for the page's ids
 * and attached afterwards.
 *
 * @param rows - the contacts of the page, in query order.
 * @param roleRows - one row per (contact, role) pair of those contacts.
 * @returns one entry per contact, in the same order, each with its role set.
 */
export function toContactsWithRoles(
  rows: readonly ContactRow[],
  roleRows: readonly ContactRoleRow[],
): readonly ContactWithRoles[] {
  const rolesByContact = new Map<string, ContactRole[]>();

  for (const row of roleRows) {
    const roles = rolesByContact.get(row.contactId);

    if (roles === undefined) {
      rolesByContact.set(row.contactId, [row.role]);
      continue;
    }

    roles.push(row.role);
  }

  return rows.map((contact) => ({
    contact,
    roles: rolesByContact.get(contact.id) ?? [],
  }));
}

/**
 * Flattens a contact row into the payload the audit diff compares.
 *
 * The same key names on both sides of a diff are what make the ledger row a
 * field-level change instead of "everything changed"; dates are ISO strings for
 * the same reason (the `before` side comes from a read, the `after` side from a
 * `RETURNING` clause).
 *
 * @param row - the row as read or as written.
 * @returns a plain record of the business columns.
 */
export function toContactAuditPayload(
  row: ContactRow,
): Readonly<Record<string, unknown>> {
  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    position: row.position,
    email: row.email,
    phone: row.phone,
    customerUserId: row.customerUserId,
    isActive: row.isActive,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    deletedAt: row.deletedAt === null ? null : toIsoString(row.deletedAt),
  };
}

/**
 * Flattens a role set into the payload of its own ledger row.
 *
 * `contact_roles` has a composite primary key and therefore no `recordId`, which
 * is exactly the case the audit contract reserved `recordId: null` for: the pair
 * travels in the payload instead of an invented id.
 *
 * @param customerId - the customer the contact belongs to.
 * @param contactId - the contact whose roles changed.
 * @param roles - the role set on that side of the diff.
 * @returns a plain record describing the set.
 */
export function toRoleAuditPayload(
  customerId: string,
  contactId: string,
  roles: readonly ContactRole[],
): Readonly<Record<string, unknown>> {
  return {
    contactId,
    customerId,
    roles: [...roles],
  };
}
