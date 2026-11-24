/**
 * Texts, ids, routes and defaults of the `customers` page (AIS-19).
 *
 * Everything user-visible lives here so the components stay markup: copy can be
 * reviewed and changed without touching JSX, and a test can assert against the
 * same constant the UI renders instead of a hard-coded string.
 *
 * The **list** path is repeated from `app/app.const.ts` because a page must not
 * import the `app` layer; `route-registry.test.ts` pins the two literals
 * together, exactly as it does for `/api-keys`.
 */

import {
  CUSTOMER_SOURCE_VALUES,
  CUSTOMER_STATUS_VALUES,
  CUSTOMER_TYPE_VALUES,
  type CustomerListQuery,
} from '@callback/shared';
import type { RadioOption, SelectOption } from '@callback/ui';
import {
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
} from '../../entities/customer/customer.const.js';
import type { CustomerWizardStep } from './customers-wizard.interface.js';
import type { CustomerWizardStepDefinition } from './customers.interface.js';

/** The list route; must equal `APP_ROUTE_CUSTOMERS_PATH`. */
export const CUSTOMERS_LIST_ROUTE_PATH = '/customers';

/** The create wizard's route. */
export const CUSTOMERS_CREATE_ROUTE_PATH = '/customers/new';

/**
 * Route template of the detail page (mounted by AIS-20).
 *
 * The `:id` segment name is deliberately **not** declared here yet: nothing on
 * this page reads it (only the detail page will, via `useParams`), and an
 * unused export fails `pnpm quality:dead-code`. AIS-20 adds it together with its
 * first consumer.
 */
export const CUSTOMER_DETAIL_ROUTE_PATH = '/customers/:id';

/** Page header. */
export const CUSTOMERS_PAGE_TITLE = 'Cégek';
export const CUSTOMERS_PAGE_SUBTITLE =
  'Az ügyfélnyilvántartás: keresés, szűrés és a cégek adatlapja.';

/** Header action of the list. */
export const CUSTOMERS_CREATE_LABEL = 'Új cég';

/** Table section. */
export const CUSTOMERS_TABLE_TITLE = 'Cégek listája';
export const CUSTOMERS_LOADING_MESSAGE = 'Cégek betöltése…';

/** Page-level error state. Retry labels are owned by `lib/error-surface.const.ts`. */
export const CUSTOMERS_ERROR_TITLE = 'A cégek betöltése nem sikerült.';

/** Empty state — the title is shared, the description depends on the filters. */
export const CUSTOMERS_EMPTY_TITLE = 'Nincs megjeleníthető cég';
export const CUSTOMERS_EMPTY_DESCRIPTION_UNFILTERED =
  'Még egy cég sincs rögzítve. Hozd létre az elsőt az „Új cég” gombbal.';
export const CUSTOMERS_EMPTY_DESCRIPTION_FILTERED =
  'A megadott szűrőkre nincs találat. Töröld a szűrőket, vagy módosítsd a keresést.';

/**
 * Filter row.
 *
 * Three filters and the free-text search — deliberately **no fourth**: the
 * responsible-operator filter was removed with its column and its contract
 * field (2026-11-24), and there is no operator directory endpoint to fill it.
 */
export const CUSTOMERS_FILTER_LABELS = {
  search: 'Keresés',
  type: 'Típus',
  status: 'Státusz',
  source: 'Forrás',
} as const;

/** Hint under the search field: which fields the server searches. */
export const CUSTOMERS_SEARCH_HINT = 'Név, adószám vagy ügyfélszám.';

/** Option shown while a filter is inactive. */
export const CUSTOMERS_FILTER_ALL_LABEL = 'Összes';

/** Reset control of the filter row. */
export const CUSTOMERS_FILTER_RESET_LABEL = 'Szűrők törlése';

/** DOM ids of the filter controls (also their `htmlFor` targets). */
export const CUSTOMERS_FILTER_FIELD_IDS = {
  search: 'customers-filter-search',
  type: 'customers-filter-type',
  status: 'customers-filter-status',
  source: 'customers-filter-source',
} as const;

/**
 * How long the search field waits before writing the URL.
 *
 * Typing is local component state (bucket 4 of the state rules); the URL only
 * receives the settled term, so one search does not create one history entry
 * per keystroke.
 */
export const CUSTOMERS_SEARCH_DEBOUNCE_MS = 300;

/**
 * The patch that clears every filter in **one** URL write.
 *
 * `undefined` means “no filter” in the list contract, and the URL builder drops
 * those keys, so the address returns to its canonical form.
 */
export const CUSTOMERS_FILTER_DEFAULTS_PATCH: Partial<CustomerListQuery> =
  Object.freeze({
    q: undefined,
    type: undefined,
    status: undefined,
    source: undefined,
  });

/** Row action labels of the per-row menu (`D3`). */
export const CUSTOMERS_ROW_ACTIONS = {
  open: 'Megnyitás',
  edit: 'Szerkesztés',
  archive: 'Archiválás',
} as const;

/** Stable ids of the row action items — what the menu reports back. */
export const CUSTOMER_ROW_ACTION_IDS = {
  open: 'open',
  edit: 'edit',
  archive: 'archive',
} as const;

/** Accessible name of the row action menu. */
export const CUSTOMERS_ROW_ACTIONS_LABEL = 'Sor műveletei';

/** Visible label of the row action trigger. */
export const CUSTOMERS_ROW_ACTIONS_TRIGGER_LABEL = 'Műveletek';

/** Archive confirmation window. */
export const CUSTOMERS_ARCHIVE_CONFIRM_TITLE = 'Cég archiválása';
export const CUSTOMERS_ARCHIVE_CONFIRM_DESCRIPTION =
  'Az archivált cég eltűnik a listákból, de az ügyfélszáma és a naplóbejegyzései megmaradnak.';
export const CUSTOMERS_ARCHIVE_CONFIRM_LABEL = 'Archiválás';

/** Filter options, built from the contract's closed value sets. */
export const CUSTOMER_TYPE_FILTER_OPTIONS: readonly SelectOption[] =
  CUSTOMER_TYPE_VALUES.map((value) => ({
    value,
    label: CUSTOMER_TYPE_LABELS[value],
  }));

export const CUSTOMER_STATUS_FILTER_OPTIONS: readonly SelectOption[] =
  CUSTOMER_STATUS_VALUES.map((value) => ({
    value,
    label: CUSTOMER_STATUS_LABELS[value],
  }));

export const CUSTOMER_SOURCE_FILTER_OPTIONS: readonly SelectOption[] =
  CUSTOMER_SOURCE_VALUES.map((value) => ({
    value,
    label: CUSTOMER_SOURCE_LABELS[value],
  }));

/** Create wizard (`AIS-19` shell; the four steps are AIS-182). */
export const CUSTOMERS_WIZARD_TITLE = 'Új cég';
export const CUSTOMERS_WIZARD_SUBTITLE =
  'Négy lépésben rögzíthető az új cég.';
export const CUSTOMERS_WIZARD_BACK_LABEL = 'Vissza a cégekhez';
export const CUSTOMERS_WIZARD_CANCEL_LABEL = 'Mégse';

/** Name of the URL parameter that carries the active step. */
export const CUSTOMERS_WIZARD_STEP_PARAM = 'step';

/** The step shown when the URL does not name one. */
export const CUSTOMERS_WIZARD_DEFAULT_STEP: CustomerWizardStep = '1';

/** The closed set of step values, in order — the `?step=` allow-list. */
export const CUSTOMER_WIZARD_STEP_VALUES: readonly CustomerWizardStep[] =
  Object.freeze(['1', '2', '3', '4']);

/**
 * Titles of the four steps.
 *
 * The `Record` over the closed step union is what lets the strip, the step
 * bodies and their tests read **one** literal; a missing step fails the build
 * instead of rendering an untitled crumb.
 */
export const CUSTOMERS_WIZARD_STEP_TITLES: Readonly<
  Record<CustomerWizardStep, string>
> = {
  '1': 'Típus',
  '2': 'Név és adószám',
  '3': 'Cím',
  '4': 'Ellenőrzés',
};

/**
 * The step strip, derived from the titles above so the two cannot disagree.
 *
 * The copy lives here so the stepper and its test assert against the same
 * constant instead of a duplicated literal.
 */
export const CUSTOMERS_WIZARD_STEPS: readonly CustomerWizardStepDefinition[] =
  CUSTOMER_WIZARD_STEP_VALUES.map((step) => ({
    step,
    title: CUSTOMERS_WIZARD_STEP_TITLES[step],
  }));

/** Step 1: the customer type options and their legend. */
export const CUSTOMER_TYPE_STEP_LEGEND = 'Cég típusa';
export const CUSTOMER_TYPE_FIELD_ID = 'customer-type';

export const CUSTOMER_TYPE_OPTIONS: readonly RadioOption[] =
  CUSTOMER_TYPE_VALUES.map((value) => ({
    value,
    label: CUSTOMER_TYPE_LABELS[value],
  }));

/** Accessible name of the wizard's step strip. */
export const CUSTOMERS_WIZARD_STEPPER_LABEL = 'A varázsló lépései';
