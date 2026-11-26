/**
 * Tests of the create wizard's pure rules (AIS-182).
 *
 * Everything here is decidable from values: the step order, which steps the draft
 * unlocks, what the one create body contains, and which step a server failure
 * blames. No React, no network — the same file that keeps the wizard's rules
 * honest without mounting a page.
 */

import { API_ERROR_CODE } from '@callback/shared';
import { describe, expect, it } from 'vitest';
import { createCodedError } from '../../test/mocks/api-error.mock.js';
import { CUSTOMERS_WIZARD_EMPTY_VALUE } from './customers.const.js';
import { CustomersWizardIncompleteError } from './customers-wizard.errors.js';
import {
  canLeaveStep,
  isDraftComplete,
  isStepReachable,
  nextStep,
  previousStep,
  toAddressValues,
  toCreateCustomerPayload,
  toNameValues,
  toReachableStep,
  toWizardServerError,
  toWizardStepOfField,
  toWizardSummary,
} from './customers-wizard.logic.js';

/** A real, checksum-valid Hungarian tax number (Magyar Telekom Nyrt.). */
const VALID_TAX_NUMBER = '10773381-2-44';

/** A value no format schema accepts — the “mistyped” case. */
const INVALID_FORMAT = 'x';

/** The smallest draft that unlocks step 2. */
const TYPE_ONLY_DRAFT = { type: 'company' } as const;

/** The smallest draft that unlocks step 3. */
const NAMED_DRAFT = { type: 'company', legalName: 'Acme Kft.' } as const;

describe('nextStep / previousStep', () => {
  it('advances from the first step to the second', () => {
    expect(nextStep('1')).toBe('2');
  });

  it('advances from the third step to the fourth', () => {
    expect(nextStep('3')).toBe('4');
  });

  it('has no next step after the last one', () => {
    expect(nextStep('4')).toBeNull();
  });

  it('has no previous step before the first one', () => {
    expect(previousStep('1')).toBeNull();
  });

  it('steps back from the second to the first', () => {
    expect(previousStep('2')).toBe('1');
  });

  it('steps back from the fourth to the third', () => {
    expect(previousStep('4')).toBe('3');
  });
});

describe('canLeaveStep', () => {
  it('rejects step 1 without a type', () => {
    expect(canLeaveStep({}, '1')).toBe(false);
  });

  it('accepts step 1 once a contract type is chosen', () => {
    expect(canLeaveStep(TYPE_ONLY_DRAFT, '1')).toBe(true);
  });

  it('rejects step 2 without a legal name', () => {
    expect(canLeaveStep(TYPE_ONLY_DRAFT, '2')).toBe(false);
  });

  it('accepts step 2 with only the legal name', () => {
    expect(canLeaveStep(NAMED_DRAFT, '2')).toBe(true);
  });

  it('rejects step 2 when the tax number is mistyped', () => {
    expect(
      canLeaveStep({ ...NAMED_DRAFT, taxNumber: INVALID_FORMAT }, '2'),
    ).toBe(false);
  });

  it('accepts step 2 with a well-formed tax number', () => {
    expect(
      canLeaveStep({ ...NAMED_DRAFT, taxNumber: VALID_TAX_NUMBER }, '2'),
    ).toBe(true);
  });

  it('accepts step 3 without an address, because it is optional', () => {
    expect(canLeaveStep(NAMED_DRAFT, '3')).toBe(true);
  });

  it('rejects step 3 when the postal code is mistyped', () => {
    expect(
      canLeaveStep({ ...NAMED_DRAFT, registeredAddressZip: '1' }, '3'),
    ).toBe(false);
  });

  it('always allows leaving the review step', () => {
    expect(canLeaveStep({}, '4')).toBe(true);
  });
});

describe('toReachableStep / isStepReachable / isDraftComplete', () => {
  it('unlocks only the first step for an empty draft', () => {
    expect(toReachableStep({})).toBe('1');
    expect(isStepReachable({}, '1')).toBe(true);
    expect(isStepReachable({}, '2')).toBe(false);
  });

  it('unlocks step 2 once the type is chosen', () => {
    expect(toReachableStep(TYPE_ONLY_DRAFT)).toBe('2');
  });

  it('unlocks the review step once the name is there', () => {
    // The address is optional in the contract, so step 3 can be left empty — the
    // step still has to be *shown*, but nothing blocks the submit after it.
    expect(toReachableStep(NAMED_DRAFT)).toBe('4');
    expect(isDraftComplete(NAMED_DRAFT)).toBe(true);
  });

  it('keeps the review step locked while a required part is missing', () => {
    expect(toReachableStep(TYPE_ONLY_DRAFT)).toBe('2');
    expect(isDraftComplete(TYPE_ONLY_DRAFT)).toBe(false);
  });

  it('does not unlock a later step when an earlier one is invalid', () => {
    const draft = { ...NAMED_DRAFT, taxNumber: INVALID_FORMAT };

    expect(isStepReachable(draft, '3')).toBe(false);
    expect(isStepReachable(draft, '2')).toBe(true);
  });
});

describe('toNameValues / toAddressValues', () => {
  it('renders an absent draft as empty strings', () => {
    expect(toNameValues({})).toEqual({
      legalName: '',
      shortName: '',
      taxNumber: '',
      euVatNumber: '',
      companyRegistrationNumber: '',
      legalForm: '',
    });
  });

  it('defaults the country to the contract value', () => {
    expect(toAddressValues({}).registeredAddressCountry).toBe('HU');
  });

  it('upper-cases the stored country code', () => {
    expect(
      toAddressValues({ registeredAddressCountry: ' de ' })
        .registeredAddressCountry,
    ).toBe('DE');
  });
});

describe('toCreateCustomerPayload', () => {
  it('omits every field the operator left empty', () => {
    const payload = toCreateCustomerPayload({
      type: 'company',
      legalName: '  Acme Kft.  ',
      shortName: '   ',
      taxNumber: '',
    });

    expect(payload).toEqual({
      type: 'company',
      legalName: 'Acme Kft.',
      shortName: undefined,
      taxNumber: undefined,
      euVatNumber: undefined,
      companyRegistrationNumber: undefined,
      legalForm: undefined,
      registeredAddressZip: undefined,
      registeredAddressCity: undefined,
      registeredAddressLine: undefined,
      registeredAddressCountry: 'HU',
    });
  });

  it('keeps the values the operator typed', () => {
    const payload = toCreateCustomerPayload({
      type: 'sole_proprietor',
      legalName: 'Acme Kft.',
      taxNumber: VALID_TAX_NUMBER,
      legalForm: 'Kft.',
      registeredAddressZip: '1052',
      registeredAddressCity: 'Budapest',
      registeredAddressLine: 'Fő utca 1.',
      registeredAddressCountry: 'hu',
    });

    expect(payload.taxNumber).toBe(VALID_TAX_NUMBER);
    expect(payload.legalForm).toBe('Kft.');
    expect(payload.registeredAddressZip).toBe('1052');
    expect(payload.registeredAddressCountry).toBe('HU');
  });

  it('throws when the draft has no type', () => {
    expect(() => toCreateCustomerPayload({ legalName: 'Acme Kft.' })).toThrow(
      CustomersWizardIncompleteError,
    );
  });

  it('throws when the draft has no legal name', () => {
    expect(() => toCreateCustomerPayload({ type: 'company' })).toThrow(
      CustomersWizardIncompleteError,
    );
  });

  it('throws when a format rule fails, naming the offending path', () => {
    try {
      toCreateCustomerPayload({
        type: 'company',
        legalName: 'Acme Kft.',
        taxNumber: INVALID_FORMAT,
      });
      throw new Error('the payload builder should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(CustomersWizardIncompleteError);
      expect(
        error instanceof CustomersWizardIncompleteError
          ? error.fieldNames
          : [],
      ).toContain('taxNumber');
    }
  });
});

describe('toWizardSummary', () => {
  it('renders a placeholder for every value the draft does not hold', () => {
    const items = toWizardSummary({});

    expect(items).toHaveLength(11);
    // The country is never a placeholder: the contract defaults it to `HU`, so
    // the last row always carries a value.
    expect(items.at(-1)?.value).toBe('HU');
    expect(
      items
        .slice(0, -1)
        .every((item) => item.value === CUSTOMERS_WIZARD_EMPTY_VALUE),
    ).toBe(true);
  });

  it('renders the type and the typed values', () => {
    const items = toWizardSummary({
      type: 'company',
      legalName: 'Acme Kft.',
      registeredAddressCity: 'Budapest',
    });

    expect(items.map((item) => item.value)).toContain('Acme Kft.');
    expect(items.map((item) => item.value)).toContain('Budapest');
    expect(items[0]?.value).not.toBe(CUSTOMERS_WIZARD_EMPTY_VALUE);
  });
});

describe('toWizardStepOfField', () => {
  it('puts the name and identifier fields on step 2', () => {
    for (const field of [
      'legalName',
      'shortName',
      'taxNumber',
      'euVatNumber',
      'companyRegistrationNumber',
      'legalForm',
    ] as const) {
      expect(toWizardStepOfField(field)).toBe('2');
    }
  });

  it('puts the address fields on step 3', () => {
    for (const field of [
      'registeredAddressZip',
      'registeredAddressCity',
      'registeredAddressLine',
      'registeredAddressCountry',
    ] as const) {
      expect(toWizardStepOfField(field)).toBe('3');
    }
  });
});

describe('toWizardServerError', () => {
  it('routes an addressed failure to the step that owns the input', () => {
    const error = createCodedError({
      status: 422,
      code: API_ERROR_CODE.SEMANTIC_VALIDATION_FAILED,
      issues: [{ path: 'registeredAddressZip', message: 'Hibás irányítószám' }],
    });

    const routing = toWizardServerError(error);

    expect(routing.step).toBe('3');
    expect(routing.error).toBe(error);
  });

  it('routes a tax-number conflict to step 2 even without issues', () => {
    const error = createCodedError({
      status: 409,
      code: API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT,
    });

    expect(toWizardServerError(error).step).toBe('2');
  });

  it('keeps a failure no input can fix on the review step', () => {
    const error = createCodedError({
      status: 500,
      code: API_ERROR_CODE.INTERNAL_ERROR,
    });

    expect(toWizardServerError(error).step).toBe('4');
  });

  it('keeps a non-ApiError value on the review step', () => {
    expect(toWizardServerError(new Error('boom')).step).toBe('4');
  });
});
