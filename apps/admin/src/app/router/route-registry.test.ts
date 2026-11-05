/**
 * Invariants of the route registry.
 *
 * The registry is the single source of truth for the routes (AIS-118, `D1`),
 * so a mistake in it is not a local bug — it breaks the navigation and the
 * routing at the same time. These tests pin the properties that must hold for
 * every entry, now and after the next page is added.
 */

import { describe, expect, it } from 'vitest';
import { API_KEYS_LIST_ROUTE_PATH } from '../../pages/api-keys/api-keys.const.js';
import {
  APP_API_PATH_PREFIX,
  APP_ROUTE_API_KEYS_PATH,
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

  it('keeps an unlinked protected entry addressable only through a URL parameter', () => {
    // A detail page has no place in the navigation (see `RouteEntry.navLabel`),
    // so `null` is legal — but only for a route a user can address by URL
    // parameter. A plain page without a label would be unreachable: no nav link
    // and nothing to type into the address bar.
    for (const route of PROTECTED_ROUTE_ENTRIES) {
      if (route.navLabel === null) {
        expect(route.path).toContain(':');
      }
    }
  });

  it('declares the api-key detail route under the identifier parameter', () => {
    // The page reads the value with `useParams` and sends it straight to
    // `GET /api/api-keys/:identifier`, so the parameter name is part of the
    // contract between the route and the service.
    const detail = PROTECTED_ROUTE_ENTRIES.find((route) =>
      route.path.includes(':identifier'),
    );

    expect(detail).toBeDefined();
    expect(detail?.navLabel).toBeNull();
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

  it('keeps the detail page return path in sync with the list route', () => {
    // `pages` must not import `app`, so the detail page carries its own copy of
    // the list path; this assertion is what keeps the copy honest.
    expect(API_KEYS_LIST_ROUTE_PATH).toBe(APP_ROUTE_API_KEYS_PATH);
  });
});
