/**
 * Invariants of the route registry.
 *
 * The registry is the single source of truth for the routes (AIS-118, `D1`),
 * so a mistake in it is not a local bug — it breaks the navigation and the
 * routing at the same time. These tests pin the properties that must hold for
 * every entry, now and after the next page is added.
 */

import { describe, expect, it } from 'vitest';
import {
  API_KEYS_LIST_ROUTE_PATH,
  API_KEY_EDIT_DIALOG_TITLE,
  API_KEY_EDIT_ROUTE_PATH,
  API_KEY_VIEW_ROUTE_PATH,
} from '../../pages/api-keys/api-keys.const.js';
import {
  APP_API_PATH_PREFIX,
  APP_NAV_HOME_LABEL,
  APP_ROUTE_API_KEYS_PATH,
  APP_ROUTE_CALLS_PATH,
  APP_ROUTE_HOME_PATH,
  APP_ROUTE_LOGIN_PATH,
} from '../app.const.js';
import {
  ALL_ROUTE_ENTRIES,
  NOT_FOUND_ROUTE_ENTRY,
  PROTECTED_ROUTE_ENTRIES,
  PUBLIC_ROUTE_ENTRIES,
} from './route-registry.js';

describe('route registry', () => {
  it('declares every path exactly once', () => {
    const paths = ALL_ROUTE_ENTRIES.map((route) => route.path);

    expect(new Set(paths).size).toBe(paths.length);
  });

  it('declares every path with a leading slash', () => {
    for (const route of ALL_ROUTE_ENTRIES) {
      expect(route.path.startsWith('/')).toBe(true);
    }
  });

  it('keeps every SPA route out of the API path prefix', () => {
    // The Vite dev proxy forwards `^/api/` to the NestJS API. A route starting
    // with that prefix would answer with JSON instead of the app shell, so the
    // page could not be opened or reloaded directly (UI-Architecture §8.1).
    for (const route of ALL_ROUTE_ENTRIES) {
      expect(route.path.startsWith(APP_API_PATH_PREFIX)).toBe(false);
    }
  });

  it('marks every protected entry as protected and every public one as public', () => {
    for (const route of PROTECTED_ROUTE_ENTRIES) {
      expect(route.protected).toBe(true);
    }

    for (const route of PUBLIC_ROUTE_ENTRIES) {
      expect(route.protected).toBe(false);
    }
  });

  it('keeps the login route public and out of the navigation', () => {
    const login = PUBLIC_ROUTE_ENTRIES.find(
      (route) => route.path === APP_ROUTE_LOGIN_PATH,
    );

    expect(login).toBeDefined();
    expect(login?.navLabel).toBeNull();
  });

  it('keeps an unlinked top-level entry addressable only through a URL parameter', () => {
    // A detail page has no place in the navigation (see `RouteEntry.navLabel`),
    // so `null` is legal — but for a top-level route only when a user can
    // address it by URL parameter. A plain page without a label would be
    // unreachable: no nav link and nothing to type into the address bar.
    //
    // Nested overlay routes (`/api-keys/new`) are exempt on purpose: they are
    // reached from their parent's own action button, not from a URL parameter
    // (AIS-155 `D2`). Since AIS-173 retired the legacy `/api-keys/:identifier`
    // page, no top-level entry is unlinked any more, so the loop guards the rule
    // for the next page that adds one.
    for (const route of PROTECTED_ROUTE_ENTRIES) {
      if (route.navLabel === null) {
        expect(route.path).toContain(':');
      }
    }
  });

  it('keeps the identifier parameter on the overlay children only', () => {
    // The overlays read the value with `useParams` and send it straight to
    // `/api/api-keys/:identifier`, so the parameter name is part of the contract
    // between the route and the service. The standalone detail page that used to
    // own the same parameter was retired in AIS-173: `/api-keys/x` now falls to
    // the catch-all, while `/api-keys/x/view` and `/api-keys/x/edit` still resolve.
    const parameterised = ALL_ROUTE_ENTRIES.filter((route) =>
      route.path.includes(':identifier'),
    );

    expect(parameterised.map((route) => route.path)).toEqual([
      API_KEY_VIEW_ROUTE_PATH,
      API_KEY_EDIT_ROUTE_PATH,
    ]);
    for (const route of parameterised) {
      expect(route.navLabel).toBeNull();
      expect(route.resolveBreadcrumbLabel).toBeDefined();
    }
  });

  it('never links a hidden route', () => {
    for (const route of PROTECTED_ROUTE_ENTRIES) {
      if (route.hidden === true) {
        expect(route.navLabel).not.toBeNull();
      }
    }
  });

  it('keeps the not-found entry unlinked and catch-all', () => {
    expect(NOT_FOUND_ROUTE_ENTRY.path).toBe('*');
    expect(NOT_FOUND_ROUTE_ENTRY.navLabel).toBeNull();
  });

  it('declares every overlay child under its parent path', () => {
    // React Router accepts an absolute child path only when it extends the
    // parent path; the breadcrumb matcher relies on the same property.
    for (const parent of PROTECTED_ROUTE_ENTRIES) {
      for (const child of parent.children ?? []) {
        expect(child.path.startsWith(parent.path)).toBe(true);
      }
    }
  });

  it('keeps overlay children out of the navigation', () => {
    const overlayChildren = PROTECTED_ROUTE_ENTRIES.flatMap(
      (route) => route.children ?? [],
    );

    for (const child of overlayChildren) {
      expect(child.navLabel).toBeNull();
    }
  });

  it('exposes every overlay child to the flat consumers', () => {
    // The breadcrumb matcher and the invariants of this file work on
    // `ALL_ROUTE_ENTRIES`, which is the flattened tree (AIS-155 `D3`).
    const flatPaths = new Set(ALL_ROUTE_ENTRIES.map((route) => route.path));

    for (const parent of PROTECTED_ROUTE_ENTRIES) {
      for (const child of parent.children ?? []) {
        expect(flatPaths.has(child.path)).toBe(true);
      }
    }
  });

  it('keeps the overlay return path in sync with the list route', () => {
    // `pages` must not import `app`, so the overlays carry their own copy of
    // the list path; this assertion is what keeps the copy honest.
    expect(API_KEYS_LIST_ROUTE_PATH).toBe(APP_ROUTE_API_KEYS_PATH);
  });
});

describe('route registry breadcrumb metadata (AIS-146)', () => {
  /** Every path the registry declares, catch-all included. */
  const knownPaths = new Set(ALL_ROUTE_ENTRIES.map((route) => route.path));

  it('points every breadcrumb parent at an existing entry', () => {
    // The trail is built by walking this pointer, so a typo would silently cut
    // the chain instead of failing a render.
    for (const route of ALL_ROUTE_ENTRIES) {
      if (route.breadcrumbParentPath !== undefined) {
        expect(knownPaths.has(route.breadcrumbParentPath)).toBe(true);
      }
    }
  });

  it('gives every dynamic route a label resolver', () => {
    for (const route of ALL_ROUTE_ENTRIES) {
      if (route.path.includes(':')) {
        expect(route.resolveBreadcrumbLabel).toBeDefined();
      }
    }
  });

  it('leaves only public and catch-all entries without a crumb', () => {
    // An entry is in a trail when it has a static label or a resolver. Anything
    // else that is reachable by URL would be a page nobody can locate.
    for (const route of ALL_ROUTE_ENTRIES) {
      const hasNoCrumb =
        route.breadcrumbLabel === null &&
        route.resolveBreadcrumbLabel === undefined;

      if (hasNoCrumb) {
        expect(route.protected === false || route.path === '*').toBe(true);
      }
    }

    expect(NOT_FOUND_ROUTE_ENTRY.breadcrumbLabel).toBeNull();
  });

  it('builds a finite trail for every entry', () => {
    for (const route of ALL_ROUTE_ENTRIES) {
      let current = route;
      let hops = 0;

      while (current.breadcrumbParentPath !== undefined) {
        const parent = ALL_ROUTE_ENTRIES.find(
          (candidate) => candidate.path === current.breadcrumbParentPath,
        );

        expect(parent).toBeDefined();

        if (parent === undefined) {
          break;
        }

        current = parent;
        hops += 1;
        expect(hops).toBeLessThanOrEqual(knownPaths.size);
      }
    }
  });

  it('shares the wording of the nav and the breadcrumb', () => {
    // Both labels of a route come from `app.const.ts`, so the two can never
    // drift into two names for the same page (AIS-146 `D10`).
    const home = PROTECTED_ROUTE_ENTRIES.find(
      (route) => route.path === APP_ROUTE_HOME_PATH,
    );
    const apiKeys = PROTECTED_ROUTE_ENTRIES.find(
      (route) => route.path === APP_ROUTE_API_KEYS_PATH,
    );
    const calls = PROTECTED_ROUTE_ENTRIES.find(
      (route) => route.path === APP_ROUTE_CALLS_PATH,
    );

    expect(home?.breadcrumbLabel).toBe(APP_NAV_HOME_LABEL);
    for (const route of [home, apiKeys, calls]) {
      expect(route?.breadcrumbLabel).toBe(route?.navLabel);
    }
  });

  it('mounts the edit overlay under the list, with the identifier crumb', () => {
    // AIS-172: editing is a URL of its own. The crumb text is the window title,
    // and the parameter fills the last segment, so a reloaded `/edit` URL still
    // says which key is being edited.
    const edit = ALL_ROUTE_ENTRIES.find(
      (route) => route.path === API_KEY_EDIT_ROUTE_PATH,
    );

    expect(edit).toBeDefined();
    expect(edit?.navLabel).toBeNull();
    expect(edit?.breadcrumbLabel).toBe(API_KEY_EDIT_DIALOG_TITLE);
    expect(edit?.breadcrumbParentPath).toBe(APP_ROUTE_API_KEYS_PATH);
    expect(edit?.resolveBreadcrumbLabel?.({ identifier: 'abc123' })).toBe(
      'abc123',
    );
  });

  it('mounts the view overlay under the list section', () => {
    // AIS-173 retired the standalone detail page, so this is now the entry that
    // carries the identifier crumb of a read.
    const view = ALL_ROUTE_ENTRIES.find(
      (route) => route.path === API_KEY_VIEW_ROUTE_PATH,
    );

    expect(view?.breadcrumbParentPath).toBe(APP_ROUTE_API_KEYS_PATH);
    expect(view?.resolveBreadcrumbLabel?.({ identifier: 'abc123' })).toBe(
      'abc123',
    );
  });
});
