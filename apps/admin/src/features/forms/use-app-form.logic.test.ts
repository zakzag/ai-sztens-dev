/**
 * Tests of `toFormErrorPlan` (AIS-115, plan `D3`/`D6`).
 *
 * The pure function decides two things the hook must not re-decide: the **order**
 * of the entries (that is what makes focus deterministic) and the fact that a
 * page-level message can coexist with field messages — it is the “one issue could
 * not be addressed” case of `toFieldErrors`. Both are asserted with plain
 * strings: the function must not know a single field name.
 */

import { describe, expect, it } from 'vitest';
import type { FieldErrorMapping } from '../../lib/field-errors.interface.js';
import { toFormErrorPlan } from './use-app-form.logic.js';

/** The declared field order every case uses; deliberately not alphabetical. */
const FIELD_PATHS = ['name', 'email', 'note'] as const;

/** Every case works on plain strings — the function is field-name agnostic. */
type HarnessField = string;

describe('toFormErrorPlan', () => {
  it('orders the entries by the declared field order, not by object order', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { note: 'note is wrong', name: 'name is wrong' },
      form: null,
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS).entries).toEqual([
      { path: 'name', message: 'name is wrong' },
      { path: 'note', message: 'note is wrong' },
    ]);
  });

  it('drops a path the form does not render', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { name: 'name is wrong', apiKey: 'not mine' },
      form: null,
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS).entries).toEqual([
      { path: 'name', message: 'name is wrong' },
    ]);
  });

  it('keeps the page-level message while still ordering the fields', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { email: 'email is wrong' },
      form: 'Egy mezőt nem sikerült azonosítani.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS)).toEqual({
      entries: [{ path: 'email', message: 'email is wrong' }],
      formMessage: 'Egy mezőt nem sikerült azonosítani.',
    });
  });

  it('reports no page-level message when every issue landed on a field', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { name: 'name is wrong' },
      form: null,
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS).formMessage).toBeNull();
  });

  it('reports no entries when the whole failure is page-level', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: {},
      form: 'A szerver hibát jelzett.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS)).toEqual({
      entries: [],
      formMessage: 'A szerver hibát jelzett.',
    });
  });

  it('returns an empty plan when nothing was mapped at all', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: {},
      form: null,
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS)).toEqual({
      entries: [],
      formMessage: null,
    });
  });
});
