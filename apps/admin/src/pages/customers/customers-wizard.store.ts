/**
 * The page store of the customers create wizard (AIS-19).
 *
 * The **first** page-local store of the admin app (`D11`, UI-Architecture §5).
 * It exists because react-hook-form seeds `defaultValues` on mount only, so a
 * per-step form cannot hand a value to the next step without somewhere to keep
 * it. What this store deliberately does **not** hold:
 *
 * - the active step — that lives in the URL (`?step=`), so a reload, the back
 *   button and a copied link all land on the same step;
 * - server data — the submitted result belongs to TanStack Query;
 * - anything persisted — a half-filled draft must not survive a reload, or it
 *   would resurrect next to a fresh `?step=1`.
 *
 * Created by {@link createCustomersWizardStore} as a **vanilla** store, so the
 * rules are testable without React; the provider in
 * `customers-wizard.provider.tsx` owns the per-mount instance.
 */

import { createStore } from 'zustand/vanilla';
import { CUSTOMERS_WIZARD_DEFAULT_STEP } from './customers.const.js';
import type {
  CustomersWizardState,
  CustomersWizardStore,
  CustomersWizardStoreApi,
} from './customers-wizard.interface.js';

/**
 * @param init - optional seed (the step mirrored from the URL on mount).
 * @returns a fresh store with an empty draft and the given step.
 */
export function createCustomersWizardStore(
  init?: Partial<CustomersWizardState>,
): CustomersWizardStoreApi {
  return createStore<CustomersWizardStore>()((set) => ({
    draft: init?.draft ?? {},
    step: init?.step ?? CUSTOMERS_WIZARD_DEFAULT_STEP,

    setDraft: (patch) => {
      set((state) => ({ draft: { ...state.draft, ...patch } }));
    },

    setStep: (step) => {
      set({ step });
    },

    reset: () => {
      set({ draft: {}, step: CUSTOMERS_WIZARD_DEFAULT_STEP });
    },
  }));
}
