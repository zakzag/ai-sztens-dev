/**
 * Types of the theme engine (AIS-165).
 *
 * The appearance union itself is `ThemeName` from `@callback/ui` — one union,
 * one home. Everything here describes the **plumbing**: the storage slice the
 * engine needs and the shape the React context carries.
 */

import type { ThemeName } from '@callback/ui';
import type { ReactNode } from 'react';

/**
 * The slice of `Storage` the engine uses.
 *
 * Declared instead of using the DOM `Storage` so the tests can pass an in-memory
 * double and the logic stays free of the DOM: `localStorage` satisfies this
 * interface structurally, and so does every test double.
 */
export interface ThemeStorage {
  /** Mirrors `Storage.getItem`. */
  readonly getItem: (key: string) => string | null;
  /** Mirrors `Storage.setItem`. */
  readonly setItem: (key: string, value: string) => void;
}

/** Props of `ThemeProvider`. */
export interface ThemeProviderProps {
  /** The subtree that may read and change the appearance. */
  readonly children: ReactNode;
}

/** The value the theme context carries. */
export interface ThemeContextValue {
  /** The appearance currently applied to the document. */
  readonly theme: ThemeName;
  /** Applies an appearance, persists it and repaints the document. */
  readonly setTheme: (theme: ThemeName) => void;
}
