/**
 * Tests of the wizard page store (AIS-19).
 *
 * The store is a **vanilla** zustand store, so every rule is asserted without
 * React: the draft merge, the step mirror and the reset.
 */

import { describe, expect, it } from 'vitest';
import { CUSTOMERS_WIZARD_DEFAULT_STEP } from './customers.const.js';
import { createCustomersWizardStore } from './customers-wizard.store.js';

describe('createCustomersWizardStore', () => {
  it('starts with an empty draft and the default step', () => {
    const store = createCustomersWizardStore();

    expect(store.getState().draft).toEqual({});
    expect(store.getState().step).toBe(CUSTOMERS_WIZARD_DEFAULT_STEP);
  });

  it('mirrors the step the URL already shows', () => {
    const store = createCustomersWizardStore({ step: '3' });

    expect(store.getState().step).toBe('3');
  });

  it('merges a draft patch without dropping the earlier fields', () => {
    const store = createCustomersWizardStore();

    store.getState().setDraft({ type: 'company' });
    store.getState().setDraft({ legalName: 'Példa Kft.' });

    expect(store.getState().draft).toEqual({
      type: 'company',
      legalName: 'Példa Kft.',
    });
  });

  it('records the current step', () => {
    const store = createCustomersWizardStore();

    store.getState().setStep('4');

    expect(store.getState().step).toBe('4');
  });

  it('reset clears the draft and returns to the first step', () => {
    const store = createCustomersWizardStore({ step: '2' });

    store.getState().setDraft({ type: 'organization' });
    store.getState().reset();

    expect(store.getState().draft).toEqual({});
    expect(store.getState().step).toBe(CUSTOMERS_WIZARD_DEFAULT_STEP);
  });

  it('keeps the draft reference stable while another field changes', () => {
    // A selector on `draft` must not re-render when only the step moves.
    const store = createCustomersWizardStore();
    const before = store.getState().draft;

    store.getState().setStep('2');

    expect(store.getState().draft).toBe(before);
  });

  it('gives each store its own instance', () => {
    const first = createCustomersWizardStore();
    const second = createCustomersWizardStore();

    first.getState().setDraft({ type: 'company' });

    expect(second.getState().draft).toEqual({});
  });
});
