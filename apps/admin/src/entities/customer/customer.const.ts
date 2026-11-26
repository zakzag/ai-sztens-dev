/**
 * Labels and status mappings of the customer entity (AIS-19).
 *
 * Hungarian copy lives here and not in the components, so the list, the detail
 * page (AIS-20) and the tests all read the same strings. `@callback/shared`
 * deliberately carries no labels: it is data, this file is copy.
 */

import type {
  ActivityType,
  AuthorType,
  AuditLogTable,
  AuditOperation,
  ContactRole,
  CustomerSource,
  CustomerStatus,
  CustomerType,
  CustomerUserRole,
  CustomerUserStatus,
  HeadcountRange,
} from '@callback/shared';
import type { ToastLevel } from '@callback/ui';
import type { BadgeVariant } from './customer.interface.js';

/** Placeholder of a value the row does not have (`null` on the wire). */
export const CUSTOMER_EMPTY_VALUE_LABEL = '—';

/** Copy of the “this customer has no primary contact yet” state. */
export const CUSTOMER_NO_PRIMARY_CONTACT_LABEL = 'Nincs';

/** Visible text of the missing-data badge. */
export const CUSTOMER_MISSING_DATA_LABEL = 'Hiányos adat';

/**
 * Accessible name of the missing-data badge.
 *
 * The badge is a colour-coded marker, and colour alone must never be the state
 * indicator (`react.coding-standards.md` §7): this sentence is what a screen
 * reader announces instead of a bare word.
 */
export const CUSTOMER_MISSING_DATA_ARIA_LABEL =
  'Hiányos adat: hiányzik az adószám vagy a bejegyzett cím.';

/** Column headers, in the render order the screen contract fixes. */
export const CUSTOMER_COLUMNS = {
  customerNumber: 'Ügyfélszám',
  name: 'Név',
  type: 'Típus',
  taxNumber: 'Adószám',
  status: 'Státusz',
  primaryContact: 'Elsődleges kapcsolattartó',
  lastActivity: 'Utolsó aktivitás',
  missingData: 'Hiányos adat',
} as const;

/** Localised customer types. */
export const CUSTOMER_TYPE_LABELS: Readonly<Record<CustomerType, string>> = {
  company: 'Cég',
  sole_proprietor: 'Egyéni vállalkozó',
  organization: 'Szervezet',
  tax_number_individual: 'Adószámos magánszemély',
};

/** Localised acquisition channels. */
export const CUSTOMER_SOURCE_LABELS: Readonly<Record<CustomerSource, string>> = {
  website: 'Weboldal',
  referral: 'Ajánlás',
  in_person: 'Személyes',
  questionnaire: 'Kérdőív',
  partner: 'Partner',
  manual: 'Kézi rögzítés',
};

/** Localised lifecycle states. */
export const CUSTOMER_STATUS_LABELS: Readonly<Record<CustomerStatus, string>> = {
  prospect: 'Érdeklődő',
  registered: 'Regisztrált',
  trial: 'Próbaidőszak',
  active: 'Aktív',
  suspended: 'Felfüggesztett',
  churned: 'Lemondott',
  anonymized: 'Anonimizált',
};

/**
 * The seven statuses mapped onto the five badge variants (AIS-17 `D10`).
 *
 * A `Record` over the closed status union, not a `switch` with a default: a new
 * status added to the contract fails the build here instead of falling silently
 * into `neutral`.
 */
export const CUSTOMER_STATUS_BADGE_VARIANT: Readonly<
  Record<CustomerStatus, BadgeVariant>
> = {
  prospect: 'neutral',
  registered: 'info',
  trial: 'info',
  active: 'success',
  suspended: 'warning',
  churned: 'danger',
  anonymized: 'neutral',
};

/**
 * Headings of the detail page's four data groups (AIS-20, screen contract
 * `D12`).
 *
 * The detail page renders exactly these four groups, in this order; the mapper
 * builds them from this table, so a group cannot be renamed in one place and
 * keep its old heading in the other.
 */
export const CUSTOMER_DETAIL_GROUP_TITLES = {
  identifiers: 'Azonosítók',
  legal: 'Jogi adatok',
  address: 'Cím',
  other: 'Egyéb',
} as const;

/**
 * Field labels of the `data` tab, keyed by concept and not by column.
 *
 * One entry per rendered pair: the group builders in the mapper read this table
 * instead of typing a label, which is what lets the detail test assert against
 * the same strings the UI shows.
 */
export const CUSTOMER_DETAIL_FIELD_LABELS = {
  customerNumber: 'Ügyfélszám',
  type: 'Típus',
  source: 'Forrás',
  createdAt: 'Létrehozva',
  updatedAt: 'Módosítva',
  legalName: 'Bejegyzett név',
  shortName: 'Rövid név',
  taxNumber: 'Adószám',
  euVatNumber: 'EU adószám',
  companyRegistrationNumber: 'Cégjegyzékszám',
  legalForm: 'Jogi forma',
  zip: 'Postai irányítószám',
  city: 'Város',
  addressLine: 'Cím',
  country: 'Ország',
  industry: 'Iparág',
  headcountRange: 'Létszám',
  lastActivity: 'Utolsó aktivitás',
} as const;

/**
 * Labels of the `overview` tab.
 *
 * `status` is not here as a pair: the overview component renders the status row
 * from {@link CustomerStatusBadge}, and only the three text pairs come from the
 * mapper (a badge is a React node, the mapper stays JSX-free).
 */
export const CUSTOMER_DETAIL_OVERVIEW_LABELS = {
  status: 'Státusz',
  statusChangedAt: 'Státuszváltás dátuma',
  primaryContact: 'Elsődleges kapcsolattartó',
} as const;

/**
 * Localised headcount bands.
 *
 * A `Record` over the closed union, like the status table: a fourth band in the
 * contract breaks the build here instead of rendering an untranslated value.
 */
export const CUSTOMER_HEADCOUNT_RANGE_LABELS: Readonly<
  Record<HeadcountRange, string>
> = {
  sole: '1 fő',
  '2_5': '2–5 fő',
  '6_20': '6–20 fő',
};

/**
 * Explanation of the missing-data notice on the overview tab.
 *
 * The title is the already-localised {@link CUSTOMER_MISSING_DATA_LABEL}, so the
 * badge in the list and the notice on the detail page cannot disagree about what
 * the flag means.
 */
export const CUSTOMER_DETAIL_MISSING_DATA_DESCRIPTION =
  'Hiányzik az adószám vagy a bejegyzett cím. A cég a listában hiányos adatként jelenik meg.';

/**
 * Marker of a contact who is also a login user of the customer (AIS-179).
 *
 * The wire says `customerUserId !== null`; the row says *Belépő*, and no cell
 * decides which word stands for that fact.
 */
export const CUSTOMER_CONTACT_LOGIN_USER_LABEL = 'Belépő';

/** Active / inactive copy of a contact row. */
export const CUSTOMER_CONTACT_ACTIVE_LABEL = 'Aktív';
export const CUSTOMER_CONTACT_INACTIVE_LABEL = 'Inaktív';

/** Shown when a contact holds no role at all — a valid state, not an error. */
export const CUSTOMER_CONTACT_NO_ROLE_LABEL = 'Nincs szerepkör';

/**
 * Localised contact roles.
 *
 * A `Record` over the contract's closed union, so a fourth role fails the build
 * here instead of rendering an untranslated value.
 */
export const CONTACT_ROLE_LABELS: Readonly<Record<ContactRole, string>> = {
  primary: 'Elsődleges',
  technical: 'Technikai',
  alerting: 'Riasztási',
};

/** Badge variant per contact role — the role table is the only mapping. */
export const CONTACT_ROLE_BADGE_VARIANT: Readonly<
  Record<ContactRole, BadgeVariant>
> = {
  primary: 'success',
  technical: 'info',
  alerting: 'warning',
};

/** Localised customer-user roles. */
export const CUSTOMER_USER_ROLE_LABELS: Readonly<
  Record<CustomerUserRole, string>
> = {
  owner: 'Tulajdonos',
  admin: 'Admin',
  member: 'Tag',
  viewer: 'Megfigyelő',
};

/** Localised customer-user statuses. */
export const CUSTOMER_USER_STATUS_LABELS: Readonly<
  Record<CustomerUserStatus, string>
> = {
  invited: 'Meghívva',
  active: 'Aktív',
  inactive: 'Inaktív',
};

/**
 * Badge variant per customer-user status.
 *
 * `invited` is `info` and not `warning`: a sent invitation is a normal step of
 * the lifecycle, not a state that needs attention.
 */
export const CUSTOMER_USER_STATUS_BADGE_VARIANT: Readonly<
  Record<CustomerUserStatus, BadgeVariant>
> = {
  invited: 'info',
  active: 'success',
  inactive: 'neutral',
};

/** Column headers of the *Kapcsolattartók* tab, in the render order. */
export const CONTACT_COLUMNS = {
  name: 'Név',
  position: 'Beosztás',
  email: 'E-mail',
  phone: 'Telefon',
  roles: 'Szerepkör',
  loginUser: 'Belépő',
  active: 'Állapot',
} as const;

/** Column headers of the *Felhasználók* tab, in the render order. */
export const CUSTOMER_USER_COLUMNS = {
  name: 'Név',
  email: 'E-mail',
  role: 'Szerepkör',
  status: 'Státusz',
  invitedAt: 'Meghívva',
  lastLogin: 'Utolsó belépés',
} as const;

// ---------------------------------------------------------------------------
// AIS-181 — the activity feed and the audit log tabs
// ---------------------------------------------------------------------------

/** Localised activity kinds. */
export const CUSTOMER_ACTIVITY_TYPE_LABELS: Readonly<
  Record<ActivityType, string>
> = {
  note: 'Megjegyzés',
  call: 'Hívás',
  email: 'E-mail',
  meeting: 'Megbeszélés',
  status_change: 'Státuszváltás',
  system: 'Rendszer',
};

/**
 * Badge variant of an activity kind.
 *
 * The three contact kinds (`call`, `email`, `meeting`) share `info`: they are
 * business events, not states, so none of them may borrow the `danger`/`warning`
 * vocabulary that the status ladder uses.
 */
export const CUSTOMER_ACTIVITY_TYPE_VARIANTS: Readonly<
  Record<ActivityType, BadgeVariant>
> = {
  note: 'neutral',
  call: 'info',
  email: 'info',
  meeting: 'info',
  status_change: 'warning',
  system: 'neutral',
};

/**
 * Kinds an operator may **write** (AIS-181 `D6`/Q2).
 *
 * `status_change` and `system` are written by the server (the status endpoint and
 * the platform itself); offering them in the note form would let an operator
 * claim an entry that the domain reserves for a machine.
 */
export const CUSTOMER_ACTIVITY_WRITABLE_TYPES = [
  'note',
  'call',
  'email',
  'meeting',
] as const satisfies readonly ActivityType[];

/** Localised operation names of the audit ledger. */
export const CUSTOMER_AUDIT_OPERATION_LABELS: Readonly<
  Record<AuditOperation, string>
> = {
  insert: 'Létrehozás',
  update: 'Módosítás',
  delete: 'Törlés',
  soft_delete: 'Törlés (archiválás)',
};

/**
 * `LogEntryRow` severity of one audited operation.
 *
 * The primitive's glyph, border and `data-level` are severity-coloured, so the
 * operation is mapped onto that vocabulary once, here: a creation is a success, a
 * correction is information, and both kinds of deletion are a warning rather than
 * an error — nothing failed, something was removed on purpose.
 */
export const CUSTOMER_AUDIT_OPERATION_LEVELS: Readonly<
  Record<AuditOperation, ToastLevel>
> = {
  insert: 'success',
  update: 'info',
  soft_delete: 'warning',
  delete: 'warning',
};

/** Localised audited table names — one entry per `AUDIT_LOG_TABLE_VALUES`. */
export const CUSTOMER_AUDIT_TABLE_LABELS: Readonly<
  Record<AuditLogTable, string>
> = {
  customers: 'Cégek',
  contacts: 'Kapcsolattartók',
  contact_roles: 'Kapcsolattartó szerepkörök',
  customer_tags: 'Cégcímkék',
  customer_users: 'Belépő felhasználók',
  activities: 'Tevékenységek',
  tags: 'Címkék',
};

/** Localised actor kinds of the ledger. */
export const CUSTOMER_AUDIT_ACTOR_TYPE_LABELS: Readonly<
  Record<AuthorType, string>
> = {
  operator: 'Operátor',
  customer_user: 'Ügyfél felhasználója',
  system: 'Rendszer',
  api_key: 'API kulcs',
};

/**
 * Hungarian labels of the wire field names a diff can carry.
 *
 * A **partial** map on purpose: `beforeData`/`afterData` hold only the changed
 * keys of an arbitrary table, so an unknown key falls back to its wire name
 * instead of rendering `undefined`.
 */
export const CUSTOMER_AUDIT_FIELD_LABELS: Readonly<Record<string, string>> = {
  // A `jsonb` snapshot can carry either spelling: the database column name
  // (`legal_name`) or the domain key the writer used (`legalName`). Both are
  // mapped, so a diff reads the same whichever side of that boundary produced it.
  legal_name: 'Jogi név',
  legalName: 'Jogi név',
  short_name: 'Rövid név',
  shortName: 'Rövid név',
  tax_number: 'Adószám',
  taxNumber: 'Adószám',
  eu_vat_number: 'EU adószám',
  euVatNumber: 'EU adószám',
  company_registration_number: 'Cégjegyzékszám',
  companyRegistrationNumber: 'Cégjegyzékszám',
  legal_form: 'Jogi forma',
  legalForm: 'Jogi forma',
  registered_address_zip: 'Irányítószám',
  registeredAddressZip: 'Irányítószám',
  registered_address_city: 'Város',
  registeredAddressCity: 'Város',
  registered_address_line: 'Cím',
  registeredAddressLine: 'Cím',
  registered_address_country: 'Ország',
  registeredAddressCountry: 'Ország',
  industry: 'Iparág',
  headcount_range: 'Létszám',
  headcountRange: 'Létszám',
  source: 'Forrás',
  status: 'Státusz',
  status_changed_at: 'Státuszváltás ideje',
  statusChangedAt: 'Státuszváltás ideje',
  customer_number: 'Ügyfélszám',
  customerNumber: 'Ügyfélszám',
  name: 'Név',
  email: 'E-mail',
  phone: 'Telefon',
  position: 'Beosztás',
  body: 'Szöveg',
  metadata: 'Metaadat',
  type: 'Típus',
  active: 'Aktív',
  role: 'Szerepkör',
  label: 'Címke',
  deleted_at: 'Törlés ideje',
  deletedAt: 'Törlés ideje',
};

/** Copy of a diff row whose one side does not exist (insert / delete). */
export const CUSTOMER_AUDIT_NO_VALUE_LABEL = '—';

/** Separator between the two sides of one diff row. */
export const CUSTOMER_AUDIT_DIFF_SEPARATOR = ' → ';
