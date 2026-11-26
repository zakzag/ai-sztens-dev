/**
 * Provider and selector hook of the customers wizard store (AIS-19).
 *
 * The instance is created **once per mount** and shared through context, so
 * navigating away from `/customers/new` disposes of the draft with the page —
 * which is the whole point of a page-local store instead of a global one.
 *
 * Nothing here is exported outside `pages/customers/`: a page store imported by
 * another page would be a global store with extra steps (UI-Architecture §6.3).
 */

import { createContext, useContext, useState } from 'react';
import { useStore } from 'zustand';
import { createCustomersWizardStore } from './customers-wizard.store.js';
import { MissingCustomersWizardStoreError } from './customers-wizard.errors.js';
import type {
  CustomersWizardStore,
  CustomersWizardStoreApi,
  CustomersWizardStoreProviderProps,
} from './customers-wizard.interface.js';

/** Name used in the error message when the provider is missing. */
const PROVIDER_NAME = 'CustomersWizardStoreProvider';

const CustomersWizardStoreContext =
  createContext<CustomersWizardStoreApi | null>(null);

/**
 * @param props - the subtree and the step the URL already shows.
 */
export function CustomersWizardStoreProvider({
  children,
  initialStep,
}: CustomersWizardStoreProviderProps) {
  // The factory runs once: `useState` with a lazy initialiser is the React way
  // to keep a created-once object across renders without an effect.
  const [store] = useState(() =>
    createCustomersWizardStore({ step: initialStep }),
  );

  return (
    <CustomersWizardStoreContext.Provider value={store}>
      {children}
    </CustomersWizardStoreContext.Provider>
  );
}

/**
 * Reads one slice of the wizard store.
 *
 * @param selector - picks the values the caller needs; never the whole store,
 *   so a component re-renders only for the fields it reads.
 * @returns the selected slice.
 * @throws {MissingCustomersWizardStoreError} when used outside the provider.
 */
export function useCustomersWizardStore<T>(
  selector: (state: CustomersWizardStore) => T,
): T {
  const store = useContext(CustomersWizardStoreContext);

  if (store === null) {
    throw new MissingCustomersWizardStoreError(PROVIDER_NAME);
  }

  return useStore(store, selector);
}
