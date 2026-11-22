/**
 * Closed value sets of the `customers` contract (AIS-16).
 *
 * Each enum is declared **once**, as a `readonly` tuple, and the zod schema is
 * derived from that tuple. Two reasons:
 *
 * 1. the values are the same strings the Postgres enum types carry (AIS-18), so
 *    the API, the admin form and the database cannot drift apart;
 * 2. `z.enum(TUPLE)` keeps the literal union, so a switch that forgets a member
 *    fails to compile instead of falling through at runtime.
 *
 * Deliberately **absent**: any billing, contract or subscription enum. Those
 * belong to AIS-176 (`service` schema); keeping them out of this file is what
 * makes “no billing data in this increment” a compile-time fact rather than a
 * convention.
 *
 * Hungarian labels are **not** here: the UI maps value → label (AIS-15). This
 * file is data, not copy.
 */

import { z } from 'zod';

/** Legal nature of the customer (`customer_type`). */
export const CUSTOMER_TYPE_VALUES = [
  'company',
  'sole_proprietor',
  'organization',
  'tax_number_individual',
] as const;

/** `customer_type` values. `individual` (consumer) is deliberately missing. */
export const customerTypeSchema = z.enum(CUSTOMER_TYPE_VALUES);

/** One legal nature of a customer. */
export type CustomerType = (typeof CUSTOMER_TYPE_VALUES)[number];

/**
 * Lifecycle state (`customer_status`).
 *
 * `anonymized` is a real state, not a flag: an anonymised row must be
 * distinguishable from a live one, and `status_changed_at` records when it
 * happened.
 */
export const CUSTOMER_STATUS_VALUES = [
  'prospect',
  'registered',
  'trial',
  'active',
  'suspended',
  'churned',
  'anonymized',
] as const;

/** `customer_status` values. */
export const customerStatusSchema = z.enum(CUSTOMER_STATUS_VALUES);

/** One lifecycle state of a customer. */
export type CustomerStatus = (typeof CUSTOMER_STATUS_VALUES)[number];

/** How the customer was acquired (`customer_source`). */
export const CUSTOMER_SOURCE_VALUES = [
  'website',
  'referral',
  'in_person',
  'questionnaire',
  'partner',
  'manual',
] as const;

/** `customer_source` values. */
export const customerSourceSchema = z.enum(CUSTOMER_SOURCE_VALUES);

/** One acquisition channel. */
export type CustomerSource = (typeof CUSTOMER_SOURCE_VALUES)[number];

/**
 * Headcount band (`headcount_range`).
 *
 * Exactly three values (AIS-16 decision): the wizard shows three options, and a
 * fourth would be a contract change, not a data change.
 */
export const HEADCOUNT_RANGE_VALUES = ['sole', '2_5', '6_20'] as const;

/** `headcount_range` values. */
export const headcountRangeSchema = z.enum(HEADCOUNT_RANGE_VALUES);

/** One headcount band. */
export type HeadcountRange = (typeof HEADCOUNT_RANGE_VALUES)[number];

/**
 * Role of a contact (`contact_role`) — a contact may hold several.
 *
 * `primary` is constrained to one per customer by a partial unique index
 * (AIS-18), not by this schema: the schema only says the value is valid.
 */
export const CONTACT_ROLE_VALUES = ['primary', 'technical', 'alerting'] as const;

/** `contact_role` values. */
export const contactRoleSchema = z.enum(CONTACT_ROLE_VALUES);

/** One contact role. */
export type ContactRole = (typeof CONTACT_ROLE_VALUES)[number];

/** Role of a customer user (`customer_user_role`). */
export const CUSTOMER_USER_ROLE_VALUES = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const;

/** `customer_user_role` values. */
export const customerUserRoleSchema = z.enum(CUSTOMER_USER_ROLE_VALUES);

/** One customer user role. */
export type CustomerUserRole = (typeof CUSTOMER_USER_ROLE_VALUES)[number];

/** Status of a customer user (`customer_user_status`). */
export const CUSTOMER_USER_STATUS_VALUES = [
  'invited',
  'active',
  'inactive',
] as const;

/** `customer_user_status` values. */
export const customerUserStatusSchema = z.enum(CUSTOMER_USER_STATUS_VALUES);

/** One customer user status. */
export type CustomerUserStatus = (typeof CUSTOMER_USER_STATUS_VALUES)[number];

/**
 * Role of an operator (`operator_role`).
 *
 * Operators are our own staff (`iam.operators`), not customer users. The two
 * tables exist because the two lifecycles differ (AIS-16 decision).
 */
export const OPERATOR_ROLE_VALUES = ['superadmin', 'operator'] as const;

/** `operator_role` values. */
export const operatorRoleSchema = z.enum(OPERATOR_ROLE_VALUES);

/** One operator role. */
export type OperatorRole = (typeof OPERATOR_ROLE_VALUES)[number];

/**
 * Kind of an activity entry (`activity_type`).
 *
 * `note` is the important one: every free-form remark about a customer is an
 * activity, which is why `customers` has no `note` column.
 */
export const ACTIVITY_TYPE_VALUES = [
  'note',
  'call',
  'email',
  'meeting',
  'status_change',
  'system',
] as const;

/** `activity_type` values. */
export const activityTypeSchema = z.enum(ACTIVITY_TYPE_VALUES);

/** One activity kind. */
export type ActivityType = (typeof ACTIVITY_TYPE_VALUES)[number];

/**
 * Who wrote an activity or performed an audited change (`author_type`).
 *
 * The audit log reuses this set plus `api_key`, because a machine caller has no
 * operator row.
 */
export const AUTHOR_TYPE_VALUES = [
  'operator',
  'customer_user',
  'system',
  'api_key',
] as const;

/** `author_type` values. */
export const authorTypeSchema = z.enum(AUTHOR_TYPE_VALUES);

/** One author kind. */
export type AuthorType = (typeof AUTHOR_TYPE_VALUES)[number];

/** Operation recorded by the audit log (`audit_operation`). */
export const AUDIT_OPERATION_VALUES = [
  'insert',
  'update',
  'delete',
  'soft_delete',
] as const;

/** `audit_operation` values. */
export const auditOperationSchema = z.enum(AUDIT_OPERATION_VALUES);

/** One audited operation. */
export type AuditOperation = (typeof AUDIT_OPERATION_VALUES)[number];

/**
 * Entry point that produced an audited change (`audit_source`).
 *
 * Optional in the contract: a worker or a migration may not know its edge, and
 * a wrong value would be worse than none.
 */
export const AUDIT_SOURCE_VALUES = [
  'admin_api',
  'web',
  'worker',
  'cron',
] as const;

/** `audit_source` values. */
export const auditSourceSchema = z.enum(AUDIT_SOURCE_VALUES);

/** One audited entry point. */
export type AuditSource = (typeof AUDIT_SOURCE_VALUES)[number];
