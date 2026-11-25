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
  CUSTOMER_USER_MANAGED_STATUS_VALUES,
  CUSTOMER_USER_ROLE_VALUES,
  HEADCOUNT_RANGE_VALUES,
  type CustomerListQuery,
} from '@callback/shared';
import type { RadioOption, SelectOption } from '@callback/ui';
import {
  CONTACT_ROLE_LABELS,
  CUSTOMER_DETAIL_GROUP_TITLES,
  CUSTOMER_HEADCOUNT_RANGE_LABELS,
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_USER_ROLE_LABELS,
  CUSTOMER_USER_STATUS_LABELS,
} from '../../entities/customer/customer.const.js';
import type { CustomerWizardStep } from './customers-wizard.interface.js';
import type {
  CustomerContactRoleFieldDefinition,
  CustomerTab,
  CustomerTabDefinition,
  CustomerWizardStepDefinition,
} from './customers.interface.js';

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

/**
 * Route template of the edit page (AIS-21).
 *
 * A **sibling** of the detail entry, not a child: editing replaces the read-only
 * page instead of floating above it (screen contract `D5`/`D14`). Both
 * `toCustomerEditRoute()` and the route registry read this one literal, so the
 * list row's *Szerkesztés* menu item and the detail header's link can never point
 * at a path the router does not serve.
 */
export const CUSTOMER_EDIT_ROUTE_PATH = '/customers/:id/edit';

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

/**
 * Name of the route parameter that carries the customer id (AIS-20).
 *
 * One literal, two consumers: the page reads it with `useParams` and the route
 * registry resolves the breadcrumb with it.
 */
export const CUSTOMER_DETAIL_PARAM = 'id';

/** Name of the URL parameter that carries the active tab (AIS-20). */
export const CUSTOMER_DETAIL_TAB_PARAM = 'tab';

/**
 * The six tabs of the detail page, in render order (screen contract §3.2).
 *
 * `satisfies` keeps the literal types — `CUSTOMER_TAB_VALUES` is derived from
 * this array — while still checking the shape, so a typo in a label cannot turn
 * into a missing tab.
 */
export const CUSTOMER_DETAIL_TABS = [
  { value: 'overview', label: 'Áttekintés' },
  { value: 'data', label: 'Cégadatok' },
  { value: 'contacts', label: 'Kapcsolattartók' },
  { value: 'users', label: 'Felhasználók' },
  { value: 'activity', label: 'Tevékenység' },
  { value: 'audit', label: 'Napló' },
] as const satisfies readonly CustomerTabDefinition[];

/**
 * The closed set of `?tab=` values — the allow-list of the URL reader.
 *
 * Derived from {@link CUSTOMER_DETAIL_TABS}, so the strip, the fallback and the
 * `Record` of tab panels can never disagree about how many tabs exist. The
 * `readonly CustomerTab[]` annotation is what makes the derived array checkable
 * against the union: a value in the strip that the union does not know would not
 * be assignable here.
 */
export const CUSTOMER_TAB_VALUES: readonly CustomerTab[] = Object.freeze(
  CUSTOMER_DETAIL_TABS.map((tab) => tab.value),
);

/** The tab shown when the URL does not name one (also dropped from the URL). */
export const CUSTOMER_DETAIL_DEFAULT_TAB = 'overview';

/** Accessible name of the tab strip's navigation landmark. */
export const CUSTOMER_DETAIL_TABS_LABEL = 'A cég adatlapjának szakaszai';

/** Back link above the page title; goes to the list, not to history. */
export const CUSTOMER_DETAIL_BACK_LABEL = 'Vissza a cégekhez';

/**
 * The page's `h1` until the payload names the customer.
 *
 * `PageShell` needs a string, and an empty heading would break the outline, so a
 * neutral title stands in while the header is a skeleton.
 */
export const CUSTOMER_DETAIL_PAGE_TITLE = 'Cég adatlapja';

/** Announced by screen readers while the header is a skeleton. */
export const CUSTOMER_DETAIL_LOADING_MESSAGE = 'A cég adatlapjának betöltése…';

/** Page-level (5xx / unexpected) failure. Retry labels come from `lib/`. */
export const CUSTOMER_DETAIL_ERROR_TITLE =
  'A cég adatlapjának betöltése nem sikerült.';

/** Unknown id — its own state, never the generic error copy. */
export const CUSTOMER_DETAIL_NOT_FOUND_TITLE = 'Ez a cég nem található.';
export const CUSTOMER_DETAIL_NOT_FOUND_MESSAGE =
  'Az azonosító nem tartozik élő céghez. Lehet, hogy archiválták, vagy hibás a hivatkozás.';

/**
 * A failure the app banner owns (offline, `401`, `503`).
 *
 * The page must not repeat the banner's sentence, so this is a neutral notice:
 * it says the detail cannot be read *now* and names no cause (AIS-96).
 */
export const CUSTOMER_DETAIL_UNAVAILABLE_TITLE =
  'A cég adatlapja most nem érhető el.';
export const CUSTOMER_DETAIL_UNAVAILABLE_DESCRIPTION =
  'A felső sávban jelzett hiba miatt az adatok nem tölthetők be. Próbáld újra, amint a kapcsolat helyreáll.';

/**
 * Body of a tab whose content is owned by a later ticket (AIS-179 / AIS-181).
 *
 * Its own copy, so a half-built tab reads as “not yet” instead of as an empty
 * table that looks like a customer without data.
 */
export const CUSTOMER_DETAIL_TAB_PLACEHOLDER_TITLE =
  'Ez a fül még nem érhető el';
export const CUSTOMER_DETAIL_TAB_PLACEHOLDER_DESCRIPTION =
  'Ez a fül a következő fejlesztésben érkezik.';

/** Page header of the edit surface (AIS-21). */
export const CUSTOMER_EDIT_PAGE_TITLE = 'Cég szerkesztése';

/** Back link above the edit title; goes to the customer's own page. */
export const CUSTOMER_EDIT_BACK_LABEL = 'Vissza az adatlapra';

/** Announced by screen readers while the edit page's read is in flight. */
export const CUSTOMER_EDIT_LOADING_MESSAGE = 'A szerkesztő űrlap betöltése…';

/** Page-level failure of the read behind the form. Retry copy comes from `lib/`. */
export const CUSTOMER_EDIT_ERROR_TITLE =
  'A cég adatlapjának betöltése nem sikerült.';

/** Action row of the edit form. */
export const CUSTOMER_EDIT_SUBMIT_LABEL = 'Mentés';
export const CUSTOMER_EDIT_CANCEL_LABEL = 'Mégse';

/**
 * Title of the form's residue alert.
 *
 * Shown only when a **field**-tier failure carried a path the form does not own
 * (`useAppForm` rule); every other tier already has its own surface.
 */
export const CUSTOMER_EDIT_FORM_ERROR_TITLE = 'A mentés nem sikerült.';

/**
 * Headings of the four `FormSection`s, in render order.
 *
 * The first three are the detail page's own group headings (`D12`), reused so the
 * read-only and the editable view of the same record cannot name a group
 * differently; only the fourth is edit-specific (the detail calls it *Egyéb*).
 */
export const CUSTOMER_EDIT_SECTION_TITLES = {
  identifiers: CUSTOMER_DETAIL_GROUP_TITLES.identifiers,
  legal: CUSTOMER_DETAIL_GROUP_TITLES.legal,
  address: CUSTOMER_DETAIL_GROUP_TITLES.address,
  classification: 'Besorolás',
} as const;

/** DOM ids of the edit inputs (also their `htmlFor` targets). */
export const CUSTOMER_EDIT_FIELD_IDS = {
  type: 'customer-edit-type',
  legalName: 'customer-edit-legal-name',
  shortName: 'customer-edit-short-name',
  taxNumber: 'customer-edit-tax-number',
  euVatNumber: 'customer-edit-eu-vat-number',
  companyRegistrationNumber: 'customer-edit-registration-number',
  legalForm: 'customer-edit-legal-form',
  registeredAddressZip: 'customer-edit-zip',
  registeredAddressCity: 'customer-edit-city',
  registeredAddressLine: 'customer-edit-address-line',
  registeredAddressCountry: 'customer-edit-country',
  industry: 'customer-edit-industry',
  headcountRange: 'customer-edit-headcount',
  source: 'customer-edit-source',
} as const;

/**
 * Hints under the three format-bearing inputs.
 *
 * Deliberately only three: a hint on every field would turn the form into a
 * manual, and the optional ones are recognisable by their empty state.
 */
export const CUSTOMER_EDIT_FIELD_HINTS = {
  taxNumber: 'Formátum: 12345678-1-23.',
  registeredAddressZip: 'Négy számjegy.',
  registeredAddressCountry: 'Kétbetűs országkód, például HU.',
} as const;

/**
 * The stale-write notice (AIS-21 key decision 2).
 *
 * This failure is **not** a field error: the blamed path is the hidden `updatedAt`
 * token, so the only useful affordance is “reload, then save again” — the notice
 * carries that action instead of pointing at an input.
 */
export const CUSTOMER_EDIT_STALE_TITLE =
  'A céget közben más módosította.';
export const CUSTOMER_EDIT_STALE_DESCRIPTION =
  'A mentés nem történt meg, mert az adatok időközben megváltoztak. Töltse újra az adatokat, majd mentse újra.';
export const CUSTOMER_EDIT_STALE_RELOAD_LABEL = 'Adatok újratöltése';

/**
 * Countries the edit form offers.
 *
 * Not a contract enum: the wire value is a free ISO 3166-1 alpha-2 code, and this
 * list is a convenience for the market the operators work in. A customer whose
 * country is not listed keeps its value — `toCountryOptions()` appends it — so the
 * form can never silently lose data.
 */
export const CUSTOMER_COUNTRY_OPTIONS: readonly SelectOption[] = Object.freeze([
  { value: 'HU', label: 'Magyarország (HU)' },
  { value: 'AT', label: 'Ausztria (AT)' },
  { value: 'SK', label: 'Szlovákia (SK)' },
  { value: 'RO', label: 'Románia (RO)' },
  { value: 'HR', label: 'Horvátország (HR)' },
  { value: 'SI', label: 'Szlovénia (SI)' },
  { value: 'RS', label: 'Szerbia (RS)' },
  { value: 'UA', label: 'Ukrajna (UA)' },
  { value: 'CZ', label: 'Csehország (CZ)' },
  { value: 'PL', label: 'Lengyelország (PL)' },
  { value: 'DE', label: 'Németország (DE)' },
]);

/**
 * Visible label of the “not set” option on the optional selects.
 *
 * An **option**, not a `placeholder`: `Select` renders its placeholder disabled,
 * which would make an optional field impossible to clear once it had a value.
 */
export const CUSTOMER_EDIT_NONE_LABEL = 'Nincs megadva';

/** Headcount bands as select options, with a clearable empty entry first. */
export const CUSTOMER_EDIT_HEADCOUNT_OPTIONS: readonly SelectOption[] =
  Object.freeze([
    { value: '', label: CUSTOMER_EDIT_NONE_LABEL },
    ...HEADCOUNT_RANGE_VALUES.map((value) => ({
      value,
      label: CUSTOMER_HEADCOUNT_RANGE_LABELS[value],
    })),
  ]);

/** Acquisition channels as select options, with a clearable empty entry first. */
export const CUSTOMER_EDIT_SOURCE_OPTIONS: readonly SelectOption[] =
  Object.freeze([
    { value: '', label: CUSTOMER_EDIT_NONE_LABEL },
    ...CUSTOMER_SOURCE_VALUES.map((value) => ({
      value,
      label: CUSTOMER_SOURCE_LABELS[value],
    })),
  ]);

/** Header of the detail page: the edit link (AIS-21). */
export const CUSTOMER_DETAIL_EDIT_LABEL = 'Szerkesztés';

/** Accessible name of the detail header's action menu. */
export const CUSTOMER_DETAIL_ACTIONS_LABEL = 'A cég műveletei';

/** Visible label of the detail header's action trigger. */
export const CUSTOMER_DETAIL_ACTIONS_TRIGGER_LABEL = 'Műveletek';

/** Stable ids of the header action items — what the menu reports back. */
export const CUSTOMER_DETAIL_ACTION_IDS = {
  status: 'status',
  archive: 'archive',
} as const;

/** Labels of the two header action items. */
export const CUSTOMER_DETAIL_ACTION_LABELS = {
  status: 'Státusz váltása',
  archive: 'Archiválás',
} as const;

/** Status-change window of the detail header. */
export const CUSTOMERS_STATUS_DIALOG_TITLE = 'Státusz váltása';
export const CUSTOMERS_STATUS_DIALOG_DESCRIPTION =
  'A státuszváltás saját naplóbejegyzést kap, és frissíti a státuszváltás dátumát is.';
export const CUSTOMERS_STATUS_FIELD_ID = 'customer-status';
export const CUSTOMERS_STATUS_FIELD_LABEL = 'Új státusz';
export const CUSTOMERS_STATUS_SUBMIT_LABEL = 'Mentés';

/** The seven statuses as select options, built from the contract's closed set. */
export const CUSTOMERS_STATUS_OPTIONS: readonly SelectOption[] =
  CUSTOMER_STATUS_VALUES.map((value) => ({
    value,
    label: CUSTOMER_STATUS_LABELS[value],
  }));

/*
  ---------------------------------------------------------------------------
  AIS-179 — the contacts and users tabs and their four child overlays
  ---------------------------------------------------------------------------
*/

/**
 * Route templates of the four child overlays of the detail entry (AIS-179).
 *
 * All four are `children` of `/customers/:id` (screen contract §1): they render
 * into the detail page's `<Outlet/>`, keep the page mounted behind them, and each
 * has an address of its own — so the URL, not a `useState`, owns "is it open".
 */
export const CUSTOMER_CONTACT_CREATE_ROUTE_PATH = '/customers/:id/contacts/new';
export const CUSTOMER_CONTACT_EDIT_ROUTE_PATH =
  '/customers/:id/contacts/:contactId/edit';
export const CUSTOMER_USER_INVITE_ROUTE_PATH = '/customers/:id/users/invite';
export const CUSTOMER_USER_EDIT_ROUTE_PATH = '/customers/:id/users/:userId/edit';

/** Route parameters of the two edit overlays. */
export const CUSTOMER_CONTACT_PARAM = 'contactId';
export const CUSTOMER_USER_PARAM = 'userId';

/**
 * Concrete address of the detail page on one tab.
 *
 * Used as the close target of every overlay: closing an invitation must return to
 * the *Felhasználók* tab, not to the default one, otherwise the operator loses
 * their place after each write.
 *
 * @param customerId - the customer's uuid.
 * @param tab - the tab to land on.
 * @returns the deep link, tab included.
 */
export function toCustomerTabRoute(
  customerId: string,
  tab: CustomerTab,
): string {
  const base = `${CUSTOMERS_LIST_ROUTE_PATH}/${encodeURIComponent(customerId)}`;

  return `${base}?${CUSTOMER_DETAIL_TAB_PARAM}=${tab}`;
}

/**
 * @param customerId - the customer's uuid.
 * @returns the address of the contact-create overlay.
 */
export function toCustomerContactCreateRoute(customerId: string): string {
  return `${CUSTOMERS_LIST_ROUTE_PATH}/${encodeURIComponent(customerId)}/contacts/new`;
}

/**
 * @param customerId - the customer's uuid.
 * @param contactId - the contact's uuid.
 * @returns the address of the contact-edit overlay.
 */
export function toCustomerContactEditRoute(
  customerId: string,
  contactId: string,
): string {
  const base = `${CUSTOMERS_LIST_ROUTE_PATH}/${encodeURIComponent(customerId)}`;

  return `${base}/contacts/${encodeURIComponent(contactId)}/edit`;
}

/**
 * @param customerId - the customer's uuid.
 * @returns the address of the invite overlay.
 */
export function toCustomerUserInviteRoute(customerId: string): string {
  return `${CUSTOMERS_LIST_ROUTE_PATH}/${encodeURIComponent(customerId)}/users/invite`;
}

/**
 * @param customerId - the customer's uuid.
 * @param userId - the login user's uuid.
 * @returns the address of the login-user edit overlay.
 */
export function toCustomerUserEditRoute(
  customerId: string,
  userId: string,
): string {
  const base = `${CUSTOMERS_LIST_ROUTE_PATH}/${encodeURIComponent(customerId)}`;

  return `${base}/users/${encodeURIComponent(userId)}/edit`;
}

/** Contacts tab: header action, row action and empty state. */
export const CUSTOMER_CONTACTS_CREATE_LABEL = 'Kapcsolattartó hozzáadása';
export const CUSTOMER_CONTACTS_TABLE_CAPTION = 'A cég kapcsolattartói';
export const CUSTOMER_CONTACTS_EMPTY_TITLE = 'Nincs kapcsolattartó';
export const CUSTOMER_CONTACTS_EMPTY_DESCRIPTION =
  'Ehhez a céghez még nem rögzítettek kapcsolattartót. Az elsőt a „Kapcsolattartó hozzáadása” gombbal veheted fel.';
export const CUSTOMER_CONTACT_EDIT_LABEL = 'Szerkesztés';
export const CUSTOMER_CONTACT_ARCHIVE_LABEL = 'Archiválás';
export const CUSTOMER_CONTACT_ARCHIVE_CONFIRM_TITLE =
  'Kapcsolattartó archiválása';
export const CUSTOMER_CONTACT_ARCHIVE_CONFIRM_DESCRIPTION =
  'Az archivált kapcsolattartó eltűnik a listából, és felszabadítja az elsődleges szerepkört.';

/** Users tab: header action, row action and empty state. */
export const CUSTOMER_USERS_INVITE_LABEL = 'Meghívás';
export const CUSTOMER_USERS_TABLE_CAPTION = 'A cég belépő felhasználói';
export const CUSTOMER_USERS_EMPTY_TITLE = 'Nincs belépő felhasználó';
export const CUSTOMER_USERS_EMPTY_DESCRIPTION =
  'Ehhez a céghez még nem tartozik belépő felhasználó. Az elsőt a „Meghívás” gombbal hívhatod meg.';
export const CUSTOMER_USER_EDIT_LABEL = 'Szerkesztés';
export const CUSTOMER_USER_REVOKE_LABEL = 'Meghívó visszavonása';
export const CUSTOMER_USER_REVOKE_CONFIRM_TITLE = 'Meghívó visszavonása';
export const CUSTOMER_USER_REVOKE_CONFIRM_DESCRIPTION =
  'A visszavont meghívó érvénytelenné válik, a felhasználó nem tud belépni.';

/** Titles and descriptions of the four overlays. */
export const CUSTOMER_CONTACT_CREATE_DIALOG_TITLE =
  'Kapcsolattartó hozzáadása';
export const CUSTOMER_CONTACT_CREATE_DIALOG_DESCRIPTION =
  'A kapcsolattartó a céghez jön létre, és azonnal megjelenik a listában.';
export const CUSTOMER_CONTACT_EDIT_DIALOG_TITLE = 'Kapcsolattartó szerkesztése';
export const CUSTOMER_USER_INVITE_DIALOG_TITLE = 'Felhasználó meghívása';
export const CUSTOMER_USER_INVITE_DIALOG_DESCRIPTION =
  'A meghívott felhasználó „Meghívva” állapotban jön létre, és csak elfogadás után tud belépni.';
export const CUSTOMER_USER_EDIT_DIALOG_TITLE = 'Felhasználó szerkesztése';

/** Not-found and failure copy of the two edit overlays. */
export const CUSTOMER_CONTACT_NOT_FOUND_TITLE =
  'Ez a kapcsolattartó nem található.';
export const CUSTOMER_CONTACT_NOT_FOUND_MESSAGE =
  'A hivatkozott kapcsolattartó már nem tartozik ehhez a céghez.';
export const CUSTOMER_USER_NOT_FOUND_TITLE = 'Ez a felhasználó nem található.';
export const CUSTOMER_USER_NOT_FOUND_MESSAGE =
  'A hivatkozott felhasználó már nem tartozik ehhez a céghez.';

/** Residue alert title of the four forms. */
export const CUSTOMER_CONTACT_FORM_ERROR_TITLE = 'A mentés nem sikerült.';
export const CUSTOMER_USER_FORM_ERROR_TITLE = 'A mentés nem sikerült.';

/** `id` of the `<form>` each overlay's footer button submits. */
export const CUSTOMER_CONTACT_FORM_ID = 'customer-contact-form';
export const CUSTOMER_USER_INVITE_FORM_ID = 'customer-user-invite-form';
export const CUSTOMER_USER_EDIT_FORM_ID = 'customer-user-edit-form';

/** Submit labels (and their pending variants) of the four forms. */
export const CUSTOMER_CONTACT_SUBMIT_LABEL = 'Mentés';
export const CUSTOMER_CONTACT_SUBMIT_PENDING_LABEL = 'Mentés…';
export const CUSTOMER_USER_INVITE_SUBMIT_LABEL = 'Meghívás';
export const CUSTOMER_USER_INVITE_SUBMIT_PENDING_LABEL = 'Meghívás…';
export const CUSTOMER_USER_EDIT_SUBMIT_LABEL = 'Mentés';
export const CUSTOMER_USER_EDIT_SUBMIT_PENDING_LABEL = 'Mentés…';

/** DOM ids of the contact form controls (also their `htmlFor` targets). */
export const CUSTOMER_CONTACT_FIELD_IDS = {
  name: 'customer-contact-name',
  position: 'customer-contact-position',
  email: 'customer-contact-email',
  phone: 'customer-contact-phone',
  customerUserId: 'customer-contact-user',
  isPrimary: 'customer-contact-role-primary',
  isTechnical: 'customer-contact-role-technical',
  isAlerting: 'customer-contact-role-alerting',
  isActive: 'customer-contact-active',
} as const;

/** Visible labels of the contact form controls. */
export const CUSTOMER_CONTACT_FIELD_LABELS = {
  name: 'Név',
  position: 'Beosztás',
  email: 'E-mail',
  phone: 'Telefon',
  customerUserId: 'Belépő felhasználó',
  roles: 'Szerepkör',
  isActive: 'Aktív kapcsolattartó',
} as const;

/** Hint of the two format-bearing contact inputs. */
export const CUSTOMER_CONTACT_FIELD_HINTS = {
  email: 'Például: kapcsolat@ceg.hu.',
  phone: 'Formátum: +36 30 123 4567.',
} as const;

/** DOM ids of the two login-user forms. */
export const CUSTOMER_USER_FIELD_IDS = {
  name: 'customer-user-name',
  email: 'customer-user-email',
  role: 'customer-user-role',
  status: 'customer-user-status',
} as const;

/** Visible labels of the two login-user forms. */
export const CUSTOMER_USER_FIELD_LABELS = {
  name: 'Név',
  email: 'E-mail',
  role: 'Szerepkör',
  status: 'Státusz',
} as const;

/** Role options of the two login-user forms, from the contract's closed set. */
export const CUSTOMER_USER_ROLE_OPTIONS: readonly SelectOption[] =
  CUSTOMER_USER_ROLE_VALUES.map((value) => ({
    value,
    label: CUSTOMER_USER_ROLE_LABELS[value],
  }));

/**
 * Status options of the edit form — the operator-managed subset only.
 *
 * `invited` is deliberately absent: it is a server-written state, and the request
 * schema rejects it (`customerUserManagedStatusSchema`).
 */
export const CUSTOMER_USER_MANAGED_STATUS_OPTIONS: readonly SelectOption[] =
  CUSTOMER_USER_MANAGED_STATUS_VALUES.map((value) => ({
    value,
    label: CUSTOMER_USER_STATUS_LABELS[value],
  }));

/**
 * Label of the “no login user” option on the contact form's user select.
 *
 * An **option**, not a placeholder: `Select` renders its placeholder disabled,
 * which would make the field impossible to clear once it had a value.
 */
export const CUSTOMER_CONTACT_NO_USER_LABEL = 'Nincs belépő felhasználó';

/**
 * The three role checkboxes of the contact form, in render order.
 *
 * A table rather than three copies of the same JSX: the order, the ids and the
 * labels stay in one place, and the test asserts against the same entries the form
 * renders.
 */
export const CUSTOMER_CONTACT_ROLE_FIELDS = [
  {
    field: 'isPrimary',
    role: 'primary',
    id: CUSTOMER_CONTACT_FIELD_IDS.isPrimary,
    label: CONTACT_ROLE_LABELS.primary,
  },
  {
    field: 'isTechnical',
    role: 'technical',
    id: CUSTOMER_CONTACT_FIELD_IDS.isTechnical,
    label: CONTACT_ROLE_LABELS.technical,
  },
  {
    field: 'isAlerting',
    role: 'alerting',
    id: CUSTOMER_CONTACT_FIELD_IDS.isAlerting,
    label: CONTACT_ROLE_LABELS.alerting,
  },
] as const satisfies readonly CustomerContactRoleFieldDefinition[];
