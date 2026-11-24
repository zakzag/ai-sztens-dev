/**
 * Types of the customers create wizard (AIS-19, filled in by AIS-182).
 *
 * The store holds **only** the transient draft and a mirror of the step; the URL
 * owns the step and TanStack Query owns the submitted result. See the state
 * table of [`Customers-Admin-Screens.md`](../../../../docs/Specs/Customers-Admin-Screens.md)
 * §4.2 and `UI-Architecture.md` §5 (`D11`).
 */

import type { ReactNode } from 'react';
import type { CreateCustomerInput } from '@callback/shared';
import type { StoreApi } from 'zustand/vanilla';

/**
 * The wizard's steps, as the `?step=` value spells them.
 *
 * Strings, not numbers: the value travels through the URL as text, and
 * converting in two places would create two definitions of “which step is
 * valid”.
 */
export type CustomerWizardStep = '1' | '2' | '3' | '4';

/** State part of the page store. */
export interface CustomersWizardState {
  /** Values collected so far; a step only ever writes the fields it owns. */
  readonly draft: Partial<CreateCustomerInput>;
  /** Mirror of `?step=`, read on mount — the URL stays the owner. */
  readonly step: CustomerWizardStep;
}

/** Actions part of the page store. */
export interface CustomersWizardActions {
  /** Merges the changed fields of the current step into the draft. */
  readonly setDraft: (patch: Partial<CreateCustomerInput>) => void;
  /** Mirrors the step the URL now shows. */
  readonly setStep: (step: CustomerWizardStep) => void;
  /** Drops the draft and returns to the first step. */
  readonly reset: () => void;
}

/** The complete store contract: state plus actions. */
export type CustomersWizardStore = CustomersWizardState & CustomersWizardActions;

/** The vanilla store handle the provider shares through context. */
export type CustomersWizardStoreApi = StoreApi<CustomersWizardStore>;

/** Props of the page store provider. */
export interface CustomersWizardStoreProviderProps {
  /** Subtree that may read the store; normally the wizard page. */
  readonly children: ReactNode;
  /** Step the URL already shows, mirrored into the store on creation. */
  readonly initialStep: CustomerWizardStep;
}
