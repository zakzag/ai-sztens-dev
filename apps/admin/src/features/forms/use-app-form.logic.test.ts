/**
 * Tests of `toFormErrorPlan` (AIS-115 `D3`/`D6`, surface rule AIS-85 `D2`).
 *
 * The pure function decides three things the hook must not re-decide: the
 * **order** of the entries (that is what makes focus deterministic), whether a
 * page-level message may coexist with field messages, and — since AIS-85 — whether
 * the form is allowed to speak at all. Both the “order” and the “who speaks”
 * questions are asserted with plain strings: the function must not know a single
 * field name.
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

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'field').entries).toEqual([
      { path: 'name', message: 'name is wrong' },
      { path: 'note', message: 'note is wrong' },
    ]);
  });

  it('drops a path the form does not render', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { name: 'name is wrong', apiKey: 'not mine' },
      form: null,
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'field').entries).toEqual([
      { path: 'name', message: 'name is wrong' },
    ]);
  });

  it('keeps the page-level message for the unaddressed residue of a field failure', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { email: 'email is wrong' },
      form: 'Egy mezőt nem sikerült azonosítani.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'field')).toEqual({
      entries: [{ path: 'email', message: 'email is wrong' }],
      formMessage: 'Egy mezőt nem sikerült azonosítani.',
    });
  });

  it('reports no page-level message when every issue landed on a field', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { name: 'name is wrong' },
      form: null,
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'field').formMessage).toBeNull();
  });

  it('reports no entries when the whole failure is page-level', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: {},
      form: 'A szerver hibát jelzett.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'field')).toEqual({
      entries: [],
      formMessage: 'A szerver hibát jelzett.',
    });
  });

  it('returns an empty plan when nothing was mapped at all', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: {},
      form: null,
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'field')).toEqual({
      entries: [],
      formMessage: null,
    });
  });

  // --- AIS-85 D2: the form only speaks for the residue of a field failure ----

  it('drops the page-level message when the capture toast owns a page failure', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: {},
      form: 'A szerver hibát jelzett.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'page').formMessage).toBeNull();
  });

  it('drops the page-level message when the banner owns the failure', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: {},
      form: 'Nincs kapcsolat.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'banner').formMessage).toBeNull();
  });

  it('drops the page-level message for a silent failure', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: {},
      form: 'Megszakítva.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'silent').formMessage).toBeNull();
  });

  it('still applies field entries when the failure was classified as page-level', () => {
    const mapping: FieldErrorMapping<HarnessField> = {
      fields: { note: 'note is wrong' },
      form: 'A szerver hibát jelzett.',
    };

    expect(toFormErrorPlan(mapping, FIELD_PATHS, 'page')).toEqual({
      entries: [{ path: 'note', message: 'note is wrong' }],
      formMessage: null,
    });
  });
});
