import { diffAuditPayload, toJsonSafeValue } from './audit-diff.logic.js';

/**
 * Unit tests for the audit diff (AIS-177).
 *
 * Pure function, no database: every branch of "what counts as a change" is
 * decided here, so the ledger's payload shape is pinned by these assertions
 * rather than by whatever a live Postgres happened to accept.
 */
describe('diffAuditPayload', () => {
  describe('insert', () => {
    it('keeps every key of the new row and no before side', () => {
      const diff = diffAuditPayload(null, {
        legal_name: 'Új Kft.',
        status: 'prospect',
      });

      expect(diff.before).toBeNull();
      expect(diff.after).toEqual({ legal_name: 'Új Kft.', status: 'prospect' });
      expect(diff.changedKeys).toEqual(['legal_name', 'status']);
      expect(diff.hasChanges).toBe(true);
    });
  });

  describe('delete', () => {
    it('keeps every key of the removed row and no after side', () => {
      const diff = diffAuditPayload({ legal_name: 'Régi Kft.' }, null);

      expect(diff.before).toEqual({ legal_name: 'Régi Kft.' });
      expect(diff.after).toBeNull();
      expect(diff.hasChanges).toBe(true);
    });
  });

  describe('update', () => {
    it('narrows both sides to the changed keys only', () => {
      const diff = diffAuditPayload(
        {
          legal_name: 'Régi Kft.',
          status: 'active',
          tax_number: '12345678-1-42',
        },
        {
          legal_name: 'Új Kft.',
          status: 'active',
          tax_number: '12345678-1-42',
        },
      );

      expect(diff.before).toEqual({ legal_name: 'Régi Kft.' });
      expect(diff.after).toEqual({ legal_name: 'Új Kft.' });
      expect(diff.changedKeys).toEqual(['legal_name']);
    });

    it('reports no change when every value is identical', () => {
      const row = { legal_name: 'Ugyanaz Kft.', status: 'active' };
      const diff = diffAuditPayload(row, { ...row });

      expect(diff.hasChanges).toBe(false);
      expect(diff.changedKeys).toEqual([]);
      // Both sides existed — an empty payload, not `null`.
      expect(diff.before).toEqual({});
      expect(diff.after).toEqual({});
    });

    it('ignores updated_at, which moves on every write', () => {
      const diff = diffAuditPayload(
        { legal_name: 'Ugyanaz Kft.', updated_at: '2026-11-22T10:00:00.000Z' },
        { legal_name: 'Ugyanaz Kft.', updated_at: '2026-11-22T11:00:00.000Z' },
      );

      expect(diff.hasChanges).toBe(false);
      expect(diff.before).toEqual({});
      expect(diff.after).toEqual({});
    });

    it('ignores the camelCase updatedAt spelling too', () => {
      const diff = diffAuditPayload(
        { legalName: 'A', updatedAt: '2026-11-22T10:00:00.000Z' },
        { legalName: 'A', updatedAt: '2026-11-22T12:00:00.000Z' },
      );

      expect(diff.hasChanges).toBe(false);
    });

    it('keeps a value that became null', () => {
      const diff = diffAuditPayload(
        { tax_number: '12345678-1-42' },
        { tax_number: null },
      );

      expect(diff.changedKeys).toEqual(['tax_number']);
      expect(diff.after).toEqual({ tax_number: null });
      expect(diff.before).toEqual({ tax_number: '12345678-1-42' });
    });

    it('keeps null and missing apart', () => {
      const diff = diffAuditPayload({ short_name: null }, {});

      expect(diff.changedKeys).toEqual(['short_name']);
      expect(diff.before).toEqual({ short_name: null });
      // The key is gone from the new row, so it must not appear on that side.
      expect(diff.after).toEqual({});
    });

    it('drops undefined values instead of storing them', () => {
      const diff = diffAuditPayload(
        { legal_name: 'A' },
        { legal_name: 'A', short_name: undefined },
      );

      expect(diff.hasChanges).toBe(false);
    });
  });

  describe('value normalisation', () => {
    it('turns a Date into the ISO string the contract carries', () => {
      const deletedAt = new Date('2026-11-22T08:30:00.000Z');
      const diff = diffAuditPayload(
        { deleted_at: null },
        { deleted_at: deletedAt },
      );

      expect(diff.after).toEqual({ deleted_at: '2026-11-22T08:30:00.000Z' });
    });

    it('treats two equal dates as one value', () => {
      const first = new Date('2026-11-22T08:30:00.000Z');
      const second = new Date('2026-11-22T08:30:00.000Z');

      expect(
        diffAuditPayload({ deleted_at: first }, { deleted_at: second })
          .hasChanges,
      ).toBe(false);
    });

    it('compares nested objects deeply', () => {
      const same = diffAuditPayload(
        { metadata: { call: { duration: 42 } } },
        { metadata: { call: { duration: 42 } } },
      );
      const different = diffAuditPayload(
        { metadata: { call: { duration: 42 } } },
        { metadata: { call: { duration: 43 } } },
      );

      expect(same.hasChanges).toBe(false);
      expect(different.changedKeys).toEqual(['metadata']);
      expect(different.after).toEqual({ metadata: { call: { duration: 43 } } });
    });

    it('compares arrays by value, not by reference', () => {
      const diff = diffAuditPayload(
        { roles: ['primary', 'technical'] },
        { roles: ['primary', 'technical'] },
      );

      expect(diff.hasChanges).toBe(false);
    });

    it('reports a changed array element', () => {
      const diff = diffAuditPayload(
        { roles: ['primary'] },
        { roles: ['technical'] },
      );

      expect(diff.changedKeys).toEqual(['roles']);
    });

    it('handles a null payload on both sides without throwing', () => {
      const diff = diffAuditPayload(null, null);

      expect(diff).toEqual({
        before: null,
        after: null,
        changedKeys: [],
        hasChanges: false,
      });
    });
  });
});

describe('toJsonSafeValue', () => {
  it('leaves primitives untouched', () => {
    expect(toJsonSafeValue('text')).toBe('text');
    expect(toJsonSafeValue(42)).toBe(42);
    expect(toJsonSafeValue(true)).toBe(true);
    expect(toJsonSafeValue(null)).toBeNull();
  });

  it('normalises dates inside arrays and objects', () => {
    const value = {
      at: new Date('2026-11-22T00:00:00.000Z'),
      list: [new Date('2026-11-22T01:00:00.000Z')],
    };

    expect(toJsonSafeValue(value)).toEqual({
      at: '2026-11-22T00:00:00.000Z',
      list: ['2026-11-22T01:00:00.000Z'],
    });
  });
});
