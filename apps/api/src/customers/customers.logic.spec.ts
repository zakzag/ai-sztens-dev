import { CustomerNumberExhaustedError } from './customers.errors.js';
import {
  hasMissingData,
  toCustomerNumberPrefix,
  toNextCustomerNumber,
  toStatusPatch,
} from './customers.logic.js';

/**
 * Unit tests of the pure `customers` rules (AIS-178).
 *
 * `now` is always injected, so the month-prefix and status-patch tests need no
 * fake timers and cannot depend on the machine's clock or time zone.
 */

describe('toCustomerNumberPrefix', () => {
  it('formats the year and the zero-padded month', () => {
    expect(toCustomerNumberPrefix(new Date('2026-11-15T09:00:00.000Z'))).toBe(
      'AIS-202611-',
    );
  });

  it('pads a single-digit month', () => {
    expect(toCustomerNumberPrefix(new Date('2027-03-02T00:00:00.000Z'))).toBe(
      'AIS-202703-',
    );
  });

  it('rolls over from December to January', () => {
    expect(toCustomerNumberPrefix(new Date('2026-12-31T23:59:59.000Z'))).toBe(
      'AIS-202612-',
    );
    expect(toCustomerNumberPrefix(new Date('2027-01-01T00:00:00.000Z'))).toBe(
      'AIS-202701-',
    );
  });

  it('uses UTC, so two servers in different zones agree on the month', () => {
    // 2026-11-01T00:30:00+01:00 is still October in UTC.
    expect(toCustomerNumberPrefix(new Date('2026-10-31T23:30:00.000Z'))).toBe(
      'AIS-202610-',
    );
  });
});

describe('toNextCustomerNumber', () => {
  const PREFIX = 'AIS-202611-';

  it('starts a month at 001', () => {
    expect(toNextCustomerNumber(PREFIX, null)).toBe('AIS-202611-001');
  });

  it('increments the stored maximum', () => {
    expect(toNextCustomerNumber(PREFIX, 'AIS-202611-001')).toBe(
      'AIS-202611-002',
    );
    expect(toNextCustomerNumber(PREFIX, 'AIS-202611-009')).toBe(
      'AIS-202611-010',
    );
    expect(toNextCustomerNumber(PREFIX, 'AIS-202611-099')).toBe(
      'AIS-202611-100',
    );
  });

  it('throws when the month is full (the format has to grow)', () => {
    expect(() => toNextCustomerNumber(PREFIX, 'AIS-202611-999')).toThrow(
      CustomerNumberExhaustedError,
    );
  });

  it('throws when the stored maximum belongs to another month', () => {
    expect(() => toNextCustomerNumber(PREFIX, 'AIS-202610-004')).toThrow(
      CustomerNumberExhaustedError,
    );
  });

  it('throws when the suffix is not a three-digit sequence', () => {
    expect(() => toNextCustomerNumber(PREFIX, 'AIS-202611-ABCD')).toThrow(
      CustomerNumberExhaustedError,
    );
    expect(() => toNextCustomerNumber(PREFIX, 'AIS-202611-12')).toThrow(
      CustomerNumberExhaustedError,
    );
  });
});

describe('hasMissingData', () => {
  it('is false when the tax number and the postal code are both known', () => {
    expect(
      hasMissingData({
        taxNumber: '10773381-2-44',
        registeredAddressZip: '1051',
      }),
    ).toBe(false);
  });

  it('is true when the tax number is unknown', () => {
    expect(
      hasMissingData({ taxNumber: null, registeredAddressZip: '1051' }),
    ).toBe(true);
  });

  it('is true when the postal code is unknown', () => {
    expect(
      hasMissingData({
        taxNumber: '10773381-2-44',
        registeredAddressZip: null,
      }),
    ).toBe(true);
  });

  it('treats a blank value as missing, not as known', () => {
    expect(
      hasMissingData({ taxNumber: '   ', registeredAddressZip: '1051' }),
    ).toBe(true);
    expect(
      hasMissingData({ taxNumber: '10773381-2-44', registeredAddressZip: '' }),
    ).toBe(true);
  });
});

describe('toStatusPatch', () => {
  it('writes the status and the change timestamp together', () => {
    const now = new Date('2026-11-22T21:00:00.000Z');

    expect(toStatusPatch('suspended', now)).toEqual({
      status: 'suspended',
      statusChangedAt: now,
    });
  });
});
