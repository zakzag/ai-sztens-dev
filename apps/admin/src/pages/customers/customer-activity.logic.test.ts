/**
 * Tests of the activity form's pure rules (AIS-181).
 *
 * The schema is the contract's own body field, so these cases are about the two
 * narrowings the screen adds: only the four writable kinds are selectable, and an
 * empty or over-long body never reaches the API.
 */

import { ACTIVITY_BODY_MAX_LENGTH } from '@callback/shared';
import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_ACTIVITY_TYPE_LABELS,
  CUSTOMER_ACTIVITY_WRITABLE_TYPES,
} from '../../entities/customer/customer.const.js';
import {
  EMPTY_ACTIVITY_FORM_VALUES,
  customerActivityEditSchema,
  customerActivityFormSchema,
  toActivityTypeOptions,
  toCreateActivityInput,
  toCustomerActivityFormValues,
  toUpdateActivityInput,
} from './customer-activity.logic.js';

describe('customerActivityFormSchema', () => {
  it('accepts a filled note', () => {
    const parsed = customerActivityFormSchema.safeParse({
      type: 'note',
      body: 'Telefonon egyeztettünk.',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an empty body', () => {
    const parsed = customerActivityFormSchema.safeParse({
      type: 'note',
      body: '   ',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects an over-long body', () => {
    const parsed = customerActivityFormSchema.safeParse({
      type: 'note',
      body: 'x'.repeat(ACTIVITY_BODY_MAX_LENGTH + 1),
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects a server-written kind', () => {
    const parsed = customerActivityFormSchema.safeParse({
      type: 'status_change',
      body: 'Státuszváltás',
    });

    expect(parsed.success).toBe(false);
  });
});

describe('customerActivityEditSchema', () => {
  it('accepts a body and rejects an empty one', () => {
    expect(customerActivityEditSchema.safeParse({ body: 'Új szöveg' }).success).toBe(
      true,
    );
    expect(customerActivityEditSchema.safeParse({ body: '' }).success).toBe(false);
  });
});

describe('toActivityTypeOptions', () => {
  it('offers exactly the four writable kinds, in contract order', () => {
    const options = toActivityTypeOptions();

    expect(options.map((option) => option.value)).toEqual([
      ...CUSTOMER_ACTIVITY_WRITABLE_TYPES,
    ]);
    expect(options.map((option) => option.label)).toEqual(
      CUSTOMER_ACTIVITY_WRITABLE_TYPES.map(
        (type) => CUSTOMER_ACTIVITY_TYPE_LABELS[type],
      ),
    );
  });
});

describe('toCreateActivityInput', () => {
  it('trims the body and keeps the chosen kind', () => {
    expect(
      toCreateActivityInput({ type: 'call', body: '  Felhívtuk  ' }),
    ).toEqual({ type: 'call', body: 'Felhívtuk' });
  });
});

describe('toUpdateActivityInput', () => {
  it('sends the trimmed body and the concurrency token', () => {
    expect(
      toUpdateActivityInput({ body: ' Módosított szöveg ' }, 'token-value'),
    ).toEqual({ body: 'Módosított szöveg', updatedAt: 'token-value' });
  });
});

describe('toCustomerActivityFormValues', () => {
  it('seeds the editor with the entry body', () => {
    const values = toCustomerActivityFormValues({
      id: 'a1',
      type: 'note',
      typeLabel: 'Megjegyzés',
      typeVariant: 'neutral',
      authorName: 'Kálmán Rák',
      authorTypeText: 'Operátor',
      createdAtText: '2026. 11. 23. 10:00',
      body: 'Eredeti szöveg',
      canEdit: true,
      updateToken: '2026-11-23T09:00:00.000Z',
    });

    expect(values).toEqual({ body: 'Eredeti szöveg' });
  });
});

describe('EMPTY_ACTIVITY_FORM_VALUES', () => {
  it('starts as a note with an empty body', () => {
    expect(EMPTY_ACTIVITY_FORM_VALUES).toEqual({ type: 'note', body: '' });
  });
});
