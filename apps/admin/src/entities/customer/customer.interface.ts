/**
 * Domain types and view models of a customer (AIS-19).
 *
 * The view model is the list's own shape: it carries **formatted text** and the
 * resolved badge variant instead of raw nullable wire fields, so no component
 * has to decide how a `null` tax number or a status renders. That decision is
 * made once, by the pure mapper, and is therefore testable without React.
 */

import type {
  ContactRole,
  CustomerStatus,
  CustomerUserRole,
  CustomerUserStatus,
} from '@callback/shared';
import type { BadgeVariants, DescriptionListItem } from '@callback/ui';

/** The badge vocabulary of `@callback/ui`, so the mapper cannot invent a variant. */
export type BadgeVariant = NonNullable<BadgeVariants['variant']>;

/**
 * One row of the customers list, ready to render.
 *
 * Every text field is already final: `displayName` has resolved `shortName ??
 * legalName`, and the three nullable wire values are rendered as their
 * placeholder copy. `status` is kept next to `statusLabel`/`statusVariant`
 * because `StatusBadge` needs the machine value for `data-status`.
 */
export interface CustomerRowViewModel {
  /** Customer uuid — the row key and the detail link segment. */
  readonly id: string;
  /** Generated identifier (`AIS-YYYYMM-NNN`), rendered in a monospace cell. */
  readonly customerNumber: string;
  /** `shortName ?? legalName`, chosen once by the mapper. */
  readonly displayName: string;
  /** Localised customer type. */
  readonly typeLabel: string;
  /** Tax number or the empty-value placeholder. */
  readonly taxNumberText: string;
  /** Machine status, kept for `data-status`. */
  readonly status: CustomerStatus;
  /** Localised status. */
  readonly statusLabel: string;
  /** Badge variant of the status (`D10` mapping). */
  readonly statusVariant: BadgeVariant;
  /** Primary contact's name, or the “no contact” copy. */
  readonly primaryContactText: string;
  /** Formatted last activity, or the empty-value placeholder. */
  readonly lastActivityText: string;
  /** `true` when the row is missing its tax number or its registered address. */
  readonly hasMissingData: boolean;
}

/** The mapped rows of one page, in server order. */
export type CustomerRowViewModels = readonly CustomerRowViewModel[];

/** Props of {@link CustomerStatusBadge}. */
export interface CustomerStatusBadgeProps {
  /** The domain status; the component resolves label and variant from it. */
  readonly status: CustomerStatus;
}

/**
 * One titled group of the detail page's `data` tab (AIS-20, screen contract
 * `D12`).
 *
 * `title` is unique inside one view model, because it is what the page uses as
 * the React key of the group's `Card` — the same assumption {@link
 * DescriptionListItem} makes about its `label`.
 */
export interface CustomerDetailGroup {
  /** Hungarian group heading, taken from the entity's copy table. */
  readonly title: string;
  /** Already formatted pairs, in render order. */
  readonly items: readonly DescriptionListItem[];
}

/**
 * The detail page's view model (AIS-20).
 *
 * The `overview` pairs deliberately **exclude** the status row: a badge is a
 * React node, and this mapper is pure (no JSX, no React import). The overview
 * component prepends the `CustomerStatusBadge` row from `status`, so the `D10`
 * mapping is still applied exactly once, by `toStatusVariant`.
 *
 * Every text field is final — a `null` has already become its placeholder copy
 * and every timestamp has already gone through `lib/date.ts` — so no component
 * decides how a missing value looks.
 */
export interface CustomerDetailViewModel {
  /** Customer uuid — the address every child overlay route is built from (AIS-179). */
  readonly id: string;
  /** `shortName ?? legalName`, chosen once by the mapper. */
  readonly displayName: string;
  /** Generated identifier (`AIS-YYYYMM-NNN`); the page's subtitle. */
  readonly customerNumber: string;
  /** Machine status, kept for the `CustomerStatusBadge` row. */
  readonly status: CustomerStatus;
  /** Status change date, primary contact and last activity, in that order. */
  readonly overview: readonly DescriptionListItem[];
  /** Azonosítók / Jogi adatok / Cím / Egyéb, in this fixed order. */
  readonly groups: readonly CustomerDetailGroup[];
  /** The customer's contacts, already formatted (AIS-179). */
  readonly contacts: CustomerContactViewModels;
  /** The customer's login users, already formatted (AIS-179). */
  readonly customerUsers: CustomerUserViewModels;
  /** `true` when the customer misses its tax number or its registered address. */
  readonly hasMissingData: boolean;
}

/**
 * One role of a contact, ready to render as a badge (AIS-179).
 *
 * The role stays next to its label and variant because `Badge` needs an
 * accessible, per-role hook (`data-role`) and the mapper is the only place that
 * knows which variant the role gets.
 */
export interface ContactRoleBadge {
  /** Machine role — rendered as `data-role`, never as visible text. */
  readonly role: ContactRole;
  /** Already localised role name. */
  readonly label: string;
  /** Visual verdict the entity's role table assigns. */
  readonly variant: BadgeVariant;
}

/**
 * One row of the *Kapcsolattartók* tab (AIS-179).
 *
 * `isLoginUser` replaces the mockup's “is a login user?” checkbox: the wire
 * carries `customerUserId`, the row carries the verdict, and no cell decides.
 */
export interface CustomerContactViewModel {
  /** Contact uuid — the row key and the edit overlay's segment. */
  readonly id: string;
  /** The contact's full name. */
  readonly name: string;
  /** Job title, or the empty-value placeholder. */
  readonly positionText: string;
  /** E-mail address, or the empty-value placeholder. */
  readonly emailText: string;
  /** Phone number, or the empty-value placeholder. */
  readonly phoneText: string;
  /** Roles as badges, in contract order; empty when the contact holds none. */
  readonly roleBadges: readonly ContactRoleBadge[];
  /** `true` when the contact is also a login user of this customer. */
  readonly isLoginUser: boolean;
  /** Screen-reader copy of {@link isLoginUser} (“belépő”), or `null`. */
  readonly loginUserText: string | null;
  /** `true` when the contact is active; archived rows never reach the UI. */
  readonly isActive: boolean;
  /** Localised active/inactive copy of the row. */
  readonly activeText: string;
  /** The version the edit overlay must send back as the concurrency token. */
  readonly updatedAt: string;
}

/** The mapped contacts of one customer, in server order. */
export type CustomerContactViewModels = readonly CustomerContactViewModel[];

/**
 * One row of the *Felhasználók* tab (AIS-179).
 *
 * `isInvited` is derived from the status and is what the tab uses to decide
 * whether the revoke action may appear: the API revokes pending invitations
 * only, so showing it on an `active` row would promise a refused write.
 */
export interface CustomerUserViewModel {
  /** Login user uuid — the row key and the edit overlay's segment. */
  readonly id: string;
  /** The user's full name. */
  readonly name: string;
  /** The user's e-mail address — the identity of an invitation. */
  readonly email: string;
  /** Machine role, kept for the form's preselect and the badge hook. */
  readonly role: CustomerUserRole;
  /** Already localised role name. */
  readonly roleLabel: string;
  /** Machine status, kept for `data-status`. */
  readonly status: CustomerUserStatus;
  /** Already localised status name. */
  readonly statusLabel: string;
  /** Badge variant of the status. */
  readonly statusVariant: BadgeVariant;
  /** Invitation date, or the empty-value placeholder. */
  readonly invitedAtText: string;
  /** Last login, or the empty-value placeholder. */
  readonly lastLoginText: string;
  /** `true` when the row is a **pending invitation** (the only revocable state). */
  readonly isInvited: boolean;
  /** The version the edit overlay must send back as the concurrency token. */
  readonly updatedAt: string;
}

/** The mapped login users of one customer, in server order. */
export type CustomerUserViewModels = readonly CustomerUserViewModel[];
