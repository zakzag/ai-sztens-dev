/**
 * Pure mapping between the DB rows, the HTTP payload and the write payloads
 * (AIS-178).
 *
 * No I/O, no Nest, no Drizzle query building — only field-level transformation,
 * which is why every branch (`null` vs. set, `Date` vs. string, derived value vs.
 * column) is trivial to unit test.
 *
 * The output types come from `@callback/shared` (`Customer`, `CustomerDetail`),
 * so this module can only ever *produce* the contract shape, never define a
 * second copy of it.
 */

import {
  CUSTOMER_DEFAULT_COUNTRY,
  CUSTOMER_INITIAL_STATUS,
  type CreateCustomerInput,
  type Customer,
  type CustomerDetail,
  type UpdateCustomerInput,
} from '@callback/shared';
import type { CustomerRow, NewCustomerRow } from '../db/schema.js';
import { toIsoString, toNullableIsoString } from '../common/date/iso-date.js';
import { hasMissingData } from './customers.logic.js';
import { toCustomerTag } from './customers-tags.mapper.js';
import { toCustomerUser } from './customers-users.mapper.js';
import type {
  ContactRoleJoinRow,
  ContactWithRoles,
  CustomerDetailRows,
  CustomerListRow,
  CustomerPatch,
} from './customers.interface.js';

/**
 * Maps a projected customer row to the list/detail payload.
 *
 * The two derived projections are **passed through as they came from SQL** — the
 * mapper never recomputes them, because a second computation would be a second
 * truth (and the only place that can answer “which activity was last” is the
 * database).
 *
 * @param row - row as returned by the repository, including the projections.
 * @returns payload with ISO 8601 timestamps and explicit `null`s.
 */
export function toCustomer(row: CustomerListRow): Customer {
  return {
    id: row.id,
    customerNumber: row.customerNumber,
    type: row.type,
    legalName: row.legalName,
    shortName: row.shortName,
    taxNumber: row.taxNumber,
    euVatNumber: row.euVatNumber,
    companyRegistrationNumber: row.companyRegistrationNumber,
    legalForm: row.legalForm,
    registeredAddressZip: row.registeredAddressZip,
    registeredAddressCity: row.registeredAddressCity,
    registeredAddressLine: row.registeredAddressLine,
    registeredAddressCountry: row.registeredAddressCountry,
    industry: row.industry,
    headcountRange: row.headcountRange,
    source: row.source,
    status: row.status,
    statusChangedAt: toIsoString(row.statusChangedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    lastActivityAt: toNullableIsoString(row.lastActivityAt),
    hasMissingData: hasMissingData(row),
    primaryContactName: row.primaryContactName,
  };
}

/**
 * Maps the four detail reads to the detail payload.
 *
 * `primaryContactName` is taken from the parent projection (the same LATERAL the
 * list uses), so the detail does **not** run a second query just to repeat what
 * the contact list already proves.
 *
 * @param rows - parent + tags + contacts with roles + customer users.
 * @returns the `GET /:id` payload.
 */
export function toCustomerDetail(rows: CustomerDetailRows): CustomerDetail {
  return {
    ...toCustomer(rows.customer),
    // The tag and login-user projections are shared with the slice-e endpoints
    // (`customers-tags.mapper.ts` / `customers-users.mapper.ts`): one mapper per
    // child shape, so the detail and the dedicated routes cannot drift apart.
    tags: rows.tags.map(toCustomerTag),
    contacts: rows.contacts.map((entry) => ({
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
    })),
    customerUsers: rows.customerUsers.map(toCustomerUser),
  };
}

/**
 * Completes a **freshly written** row with the two derived projections.
 *
 * A row that was just created has no activities and no contacts, so `null` for
 * both is a fact, not a placeholder. Every other path reads the projections from
 * SQL instead of calling this function — which is exactly why it is named after
 * the create case and not “with defaults”.
 *
 * @param row - the row returned by `INSERT … RETURNING`.
 * @returns the row in the shape the list/detail projection has.
 */
export function toCreatedListRow(row: CustomerRow): CustomerListRow {
  return { ...row, lastActivityAt: null, primaryContactName: null };
}

/**
 * Maps a validated `POST` body to an insert payload.
 *
 * Two groups of values are **not** the body's:
 *
 * - `customerNumber`, written by the service from the allocated sequence;
 * - `statusChangedAt`, `createdAt` / `updatedAt` / `deletedAt`, owned by the
 *   database.
 *
 * `statusChangedAt` is deliberately **not** set here. It has a `now()` default,
 * and letting the statement fill both it and `created_at` is what keeps the two
 * identical: a value written by the application clock differs from the DB's
 * `now()` by a millisecond or two, and the AIS-14 e2e asserts the equality
 * (`statusChangedAt === createdAt` for a brand-new row).
 *
 * `status` **is** taken from the body (plan `D3`): the contract publishes it with
 * a `prospect` default, and the parsed value already carries that default. The
 * fallback below is what makes the function safe to call with the *input* type
 * too, where the field is optional.
 *
 * Omitted optional fields become explicit `null`: “absent” and “explicitly
 * empty” must not become two different DB states.
 *
 * @param input - validated body of `POST /api/admin/customers`.
 * @param customerNumber - the number allocated for this insert.
 * @returns insert payload for `customer.customers`.
 */
export function toNewCustomerRow(
  input: CreateCustomerInput,
  customerNumber: string,
): NewCustomerRow {
  return {
    customerNumber,
    type: input.type,
    legalName: input.legalName,
    shortName: input.shortName ?? null,
    taxNumber: input.taxNumber ?? null,
    euVatNumber: input.euVatNumber ?? null,
    companyRegistrationNumber: input.companyRegistrationNumber ?? null,
    legalForm: input.legalForm ?? null,
    registeredAddressZip: input.registeredAddressZip ?? null,
    registeredAddressCity: input.registeredAddressCity ?? null,
    registeredAddressLine: input.registeredAddressLine ?? null,
    registeredAddressCountry:
      input.registeredAddressCountry ?? CUSTOMER_DEFAULT_COUNTRY,
    industry: input.industry ?? null,
    headcountRange: input.headcountRange ?? null,
    source: input.source ?? null,
    status: input.status ?? CUSTOMER_INITIAL_STATUS,
  };
}

/**
 * Maps a validated `PATCH` body to the column subset the repository writes.
 *
 * The distinction the two have to preserve is `undefined` vs. `null`:
 *
 * - an **absent** key stays absent in the patch, which the repository reads as
 *   “do not touch this column”;
 * - an explicit **`null`** is passed through as `null`, which clears it.
 *
 * `updatedAt` is read by the caller (it is the concurrency token, compared
 * against the stored value) and is deliberately **not** part of the patch.
 *
 * An empty result is meaningful, not a bug: it means “nothing to write”, which
 * the service short-circuits into a read-only answer with **no** audit row
 * (plan `D7`) — an empty `UPDATE` would bump `updated_at` for no reason.
 *
 * @param input - validated body of `PATCH /api/admin/customers/:id`.
 * @returns the columns to write; possibly empty.
 */
export function toCustomerPatch(input: UpdateCustomerInput): CustomerPatch {
  return {
    ...(input.type === undefined ? {} : { type: input.type }),
    ...(input.legalName === undefined ? {} : { legalName: input.legalName }),
    ...(input.shortName === undefined ? {} : { shortName: input.shortName }),
    ...(input.taxNumber === undefined ? {} : { taxNumber: input.taxNumber }),
    ...(input.euVatNumber === undefined
      ? {}
      : { euVatNumber: input.euVatNumber }),
    ...(input.companyRegistrationNumber === undefined
      ? {}
      : { companyRegistrationNumber: input.companyRegistrationNumber }),
    ...(input.legalForm === undefined ? {} : { legalForm: input.legalForm }),
    ...(input.registeredAddressZip === undefined
      ? {}
      : { registeredAddressZip: input.registeredAddressZip }),
    ...(input.registeredAddressCity === undefined
      ? {}
      : { registeredAddressCity: input.registeredAddressCity }),
    ...(input.registeredAddressLine === undefined
      ? {}
      : { registeredAddressLine: input.registeredAddressLine }),
    ...(input.registeredAddressCountry === undefined
      ? {}
      : { registeredAddressCountry: input.registeredAddressCountry }),
    ...(input.industry === undefined ? {} : { industry: input.industry }),
    ...(input.headcountRange === undefined
      ? {}
      : { headcountRange: input.headcountRange }),
    ...(input.source === undefined ? {} : { source: input.source }),
  };
}

/**
 * Groups the `contacts ⋈ contact_roles` join under the contacts it produced.
 *
 * The join returns one row per (contact, role) pair — and, because it is a
 * **left** join, exactly one row with `role: null` for a contact without any
 * role. The grouping is what turns that back into “a contact with its roles”,
 * in one round trip instead of two.
 *
 * Two details:
 *
 * - the result keeps the **contact order** of the query, so the wire order is
 *   the query's order (the detail response is rendered as-is);
 * - a contact that appears only with `role: null` still appears, with an empty
 *   list — “no role yet” is an empty array, never a missing contact.
 *
 * De-duplication is by contact **id**, not by object identity: the driver builds
 * a fresh object per row, so a `Map` keyed on the id is the only reliable
 * grouping key.
 *
 * @param rows - joined rows of `contacts` and `contact_roles`.
 * @returns one entry per distinct contact, each with its roles.
 */
export function toContactsWithRoles(
  rows: readonly ContactRoleJoinRow[],
): readonly ContactWithRoles[] {
  const byContact = new Map<string, ContactWithRoles>();

  for (const row of rows) {
    const existing = byContact.get(row.contact.id);

    if (existing === undefined) {
      byContact.set(row.contact.id, {
        contact: row.contact,
        roles: row.role === null ? [] : [row.role],
      });
      continue;
    }

    if (row.role !== null) {
      existing.roles.push(row.role);
    }
  }

  return [...byContact.values()];
}

/**
 * Flattens a row (or a projected row) into the payload the audit diff compares.
 *
 * The audit writer narrows `before`/`after` to the **changed** keys, so it needs
 * the same key names on both sides: mapping through this function for both the
 * pre-image and the post-image makes the diff a field-level comparison instead
 * of “everything changed because one side is a row and the other is a payload”.
 *
 * Dates are converted to ISO strings for the same reason: `before` comes from a
 * read and `after` from a `RETURNING` clause, and the two must be comparable.
 *
 * @param row - the row as read or as written.
 * @returns a plain record of the business columns.
 */
export function toCustomerAuditPayload(
  row: CustomerRow,
): Readonly<Record<string, unknown>> {
  return {
    id: row.id,
    customerNumber: row.customerNumber,
    type: row.type,
    legalName: row.legalName,
    shortName: row.shortName,
    taxNumber: row.taxNumber,
    euVatNumber: row.euVatNumber,
    companyRegistrationNumber: row.companyRegistrationNumber,
    legalForm: row.legalForm,
    registeredAddressZip: row.registeredAddressZip,
    registeredAddressCity: row.registeredAddressCity,
    registeredAddressLine: row.registeredAddressLine,
    registeredAddressCountry: row.registeredAddressCountry,
    industry: row.industry,
    headcountRange: row.headcountRange,
    source: row.source,
    status: row.status,
    statusChangedAt: toIsoString(row.statusChangedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    deletedAt: toNullableIsoString(row.deletedAt),
  };
}
