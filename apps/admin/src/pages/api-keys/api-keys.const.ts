/**
 * Texts, ids and defaults of the `api-keys` page.
 *
 * Everything user-visible lives here so the components stay markup: copy can be
 * reviewed and changed without touching JSX, and a test can assert against the
 * same constant the UI renders instead of a hard-coded string.
 */

import {
  LIST_QUERY_DEFAULT_LIMIT,
  LIST_QUERY_MAX_LIMIT,
} from '@callback/shared';
import type {
  ApiKeyEditFormFieldName,
  ApiKeyFormFieldName,
} from '../../features/api-keys/api-keys.interface.js';
import type { ApiKeyFormValues } from './api-keys.interface.js';

/** Page header. */
export const API_KEYS_PAGE_TITLE = 'API kulcsok';
export const API_KEYS_PAGE_SUBTITLE =
  'A külső szolgáltatók (pl. hangasszisztens) hozzáférési kulcsai. A kulcs értéke a mentés után nem jelenik meg újra.';

/**
 * Header action of the list (AIS-155).
 *
 * The label is both the visible text and the accessible name — no separate
 * `aria-label`, so what a screen reader announces is exactly what the user sees
 * (WCAG 2.5.3). The route literal lives here for the same reason the detail
 * template does: the page must not import `app`, and the registry mounts exactly
 * this string.
 */
export const API_KEYS_CREATE_LABEL = 'Új API kulcs';
export const API_KEYS_CREATE_ROUTE_PATH = '/api-keys/new';

/** Table section. */
export const API_KEYS_TABLE_TITLE = 'Tárolt kulcsok';
export const API_KEYS_LOADING_MESSAGE = 'API kulcsok betöltése…';
export const API_KEYS_EMPTY_MESSAGE =
  'Még nincs tárolt API kulcs. Hozd létre az elsőt az „Új API kulcs” gombbal.';
/**
 * Title of the page-level error state. The retry labels are owned by
 * `lib/error-surface.const.ts`, because every page's retry button reads the same.
 */
export const API_KEYS_ERROR_TITLE = 'Az API kulcsok betöltése nem sikerült.';

/** Column headers, in render order. */
export const API_KEY_COLUMNS = {
  name: 'Név',
  identifier: 'Azonosító',
  description: 'Leírás',
  expiresAt: 'Lejárat',
} as const;

/**
 * Page sizes the pager offers: the contract default, a middle value and the
 * contract maximum.
 *
 * Declared by the **page**, not by `@callback/ui`: the primitive must not import
 * `@callback/shared`, so the numbers are injected here, where the contract is
 * already known (AIS-116 §7.3).
 */
export const API_KEYS_LIMIT_OPTIONS: readonly number[] = Object.freeze([
  LIST_QUERY_DEFAULT_LIMIT,
  50,
  LIST_QUERY_MAX_LIMIT,
]);

/**
 * Create overlay (AIS-155).
 *
 * The form lives **inside** the overlay body, so it carries no title of its own:
 * the window title is the heading, and the submit button sits in the overlay
 * footer and submits this form by its id.
 */
export const API_KEY_CREATE_DIALOG_TITLE = 'Új API kulcs';
export const API_KEY_CREATE_DIALOG_SUBTITLE =
  'A kulcs értéke a mentés után nem jelenik meg újra, ezért előbb szerezd be a szolgáltatótól.';
/** DOM id of the create form — the target of the footer submit button. */
export const API_KEY_CREATE_FORM_ID = 'api-key-create-form';
export const API_KEY_CREATE_SUBMIT_LABEL = 'Létrehozás';
export const API_KEY_CREATE_PENDING_LABEL = 'Mentés…';
export const API_KEY_FORM_SUCCESS_MESSAGE = 'Az új API kulcs elmentve.';
export const API_KEY_FORM_ERROR_TITLE = 'Az API kulcs mentése nem sikerült.';

/**
 * DOM ids of the form controls — also the `htmlFor`/`error` wiring keys.
 *
 * Typed as a complete map over {@link ApiKeyFormFieldName} so a new field cannot
 * be rendered without an id, and a renamed one breaks the build instead of the
 * accessibility wiring.
 */
export const API_KEY_FORM_FIELD_IDS: Readonly<
  Record<ApiKeyFormFieldName, string>
> = {
  name: 'api-key-name',
  identifier: 'api-key-identifier',
  description: 'api-key-description',
  apiKey: 'api-key-value',
  expiresAt: 'api-key-expires-at',
};

/** Visible labels, one per form field. */
export const API_KEY_FORM_LABELS: Readonly<
  Record<ApiKeyFormFieldName, string>
> = {
  name: 'Név',
  identifier: 'Azonosító',
  description: 'Leírás',
  apiKey: 'API kulcs értéke',
  expiresAt: 'Lejárat',
};

/** Helper texts under the fields. */
export const API_KEY_FORM_HINTS: Readonly<Record<ApiKeyFormFieldName, string>> =
  {
    name: 'Emberi olvasásra szánt név, legfeljebb 200 karakter.',
    identifier:
      'Egyedi, URL-biztos azonosító: betű, szám, pont, kötőjel, aláhúzás.',
    description: 'Opcionális, legfeljebb 2000 karakter.',
    apiKey: 'A szolgáltatótól kapott token értéke.',
    expiresAt: 'Opcionális. Üresen hagyva a kulcs nem jár le.',
  };

/**
 * Initial (and post-success) form values.
 *
 * Declared here rather than derived in the logic module, so the dependency runs
 * one way only: `logic → const` and never `const → logic`.
 */
export const API_KEY_FORM_DEFAULTS: ApiKeyFormValues = {
  name: '',
  identifier: '',
  description: '',
  apiKey: '',
  expiresAt: '',
};

/**
 * Route template of the detail page (AIS-131).
 *
 * Declared here, not in `app/app.const.ts`: the **table** links to it and a page
 * must not import `app`, while the route registry (which may import a page)
 * mounts exactly the same literal. The parameter name matches the API route
 * (`/api/api-keys/:identifier`), so the page can pass it straight through.
 */
export const API_KEY_DETAIL_ROUTE_PATH = '/api-keys/:identifier';

/**
 * Route template of the read-only overlay (AIS-155).
 *
 * A sibling of the detail route, not a variant of it: `/view` is the standard
 * read-only window of the list, while the legacy detail page keeps the delete
 * and the inline editor until it is retired.
 */
export const API_KEY_VIEW_ROUTE_PATH = '/api-keys/:identifier/view';

/** Name of the detail route's URL parameter, shared by the router and the page. */
export const API_KEY_DETAIL_PARAM = 'identifier';

/**
 * Read-only overlay copy (AIS-155).
 *
 * The dismiss label differs from the header `X`'s `Bezárás` on purpose: two
 * controls with the same accessible name are indistinguishable for a screen
 * reader user, and this one also says where it goes.
 */
export const API_KEY_VIEW_DIALOG_TITLE = 'API kulcs';
export const API_KEY_VIEW_CLOSE_LABEL = 'Vissza a listához';
export const API_KEY_VIEW_DELETE_LINK_LABEL = 'Teljes oldal (törlés)';

/** Detail page header. */
export const API_KEY_DETAIL_TITLE = 'API kulcs';
export const API_KEY_DETAIL_SUBTITLE =
  'A kulcs adatai. Az azonosító és a kulcs értéke itt nem módosítható.';

/** Label/state texts of the detail page. */
export const API_KEY_DETAIL_LOADING_MESSAGE = 'API kulcs betöltése…';
export const API_KEY_DETAIL_ERROR_TITLE = 'Az API kulcs betöltése nem sikerült.';
export const API_KEY_DETAIL_NOT_FOUND_TITLE = 'Az API kulcs nem található.';
export const API_KEY_DETAIL_NOT_FOUND_MESSAGE =
  'Lehet, hogy közben törölték. Térj vissza a listához, és ellenőrizd az azonosítót.';
export const API_KEY_DETAIL_BACK_LABEL = 'Vissza a listához';
export const API_KEY_DETAIL_BACK_ARIA_LABEL = 'Vissza az API kulcsok listájához';

/** Labels of the `DescriptionList` rows, in render order. */
export const API_KEY_DETAIL_FIELD_LABELS = {
  name: 'Név',
  identifier: 'Azonosító',
  description: 'Leírás',
  expiresAt: 'Lejárat',
  expiry: 'Állapot',
  createdAt: 'Létrehozva',
  updatedAt: 'Utoljára módosítva',
} as const;

/**
 * Copy of the lost-update case (409 `STALE_WRITE`).
 *
 * A reload is the only useful action: the blamed `updatedAt` is a hidden
 * concurrency token, so retrying the same payload would fail identically.
 */
export const API_KEY_DETAIL_STALE_WRITE_TITLE =
  'Az adatot közben valaki más módosította.';
export const API_KEY_DETAIL_STALE_WRITE_MESSAGE =
  'A mentés nem történt meg, mert a kulcs azóta megváltozott. Töltsd újra az adatokat, és vidd fel újra a módosítást.';
export const API_KEY_DETAIL_STALE_WRITE_ACTION = 'Adatok újratöltése';

/** Delete affordance. */
export const API_KEY_DELETE_LABEL = 'Kulcs törlése';
export const API_KEY_DELETE_DIALOG_TITLE = 'Biztosan törlöd ezt az API kulcsot?';
export const API_KEY_DELETE_DIALOG_DESCRIPTION =
  'A kulcs azonnal érvénytelenné válik, és a listából is eltűnik. Ez a művelet nem vonható vissza.';
export const API_KEY_DELETE_CONFIRM_LABEL = 'Törlés';
export const API_KEY_DELETE_CANCEL_LABEL = 'Mégsem';

/** Edit form. */
export const API_KEY_EDIT_FORM_TITLE = 'API kulcs szerkesztése';
export const API_KEY_EDIT_FORM_SUBMIT_LABEL = 'Módosítások mentése';
export const API_KEY_EDIT_FORM_PENDING_LABEL = 'Mentés…';
export const API_KEY_EDIT_FORM_SUCCESS_MESSAGE = 'A módosítások elmentve.';
export const API_KEY_EDIT_FORM_ERROR_TITLE =
  'A módosítások mentése nem sikerült.';

/** DOM ids of the edit controls — also the `htmlFor`/`error` wiring keys. */
export const API_KEY_EDIT_FORM_FIELD_IDS: Readonly<
  Record<ApiKeyEditFormFieldName, string>
> = {
  name: 'api-key-edit-name',
  description: 'api-key-edit-description',
  expiresAt: 'api-key-edit-expires-at',
};

/** Visible labels, one per edit field. */
export const API_KEY_EDIT_FORM_LABELS: Readonly<
  Record<ApiKeyEditFormFieldName, string>
> = {
  name: 'Név',
  description: 'Leírás',
  expiresAt: 'Lejárat',
};

/** Helper texts under the edit fields, mirroring the create form. */
export const API_KEY_EDIT_FORM_HINTS: Readonly<
  Record<ApiKeyEditFormFieldName, string>
> = {
  name: 'Emberi olvasásra szánt név, legfeljebb 200 karakter.',
  description: 'Opcionális, legfeljebb 2000 karakter.',
  expiresAt: 'Opcionális. Üresen hagyva a kulcs nem jár le.',
};

/**
 * List route the detail page returns to after a delete.
 *
 * A page must not import `app`, so the literal is repeated here; the route
 * registry test pins it to `APP_ROUTE_API_KEYS_PATH`, so the two cannot drift.
 */
export const API_KEYS_LIST_ROUTE_PATH = '/api-keys';

