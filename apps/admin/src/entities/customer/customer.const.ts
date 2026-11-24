/**
 * Labels and status mappings of the customer entity (AIS-19).
 *
 * Hungarian copy lives here and not in the components, so the list, the detail
 * page (AIS-20) and the tests all read the same strings. `@callback/shared`
 * deliberately carries no labels: it is data, this file is copy.
 */

import type {
  CustomerSource,
  CustomerStatus,
  CustomerType,
} from '@callback/shared';
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
