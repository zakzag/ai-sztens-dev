import {
  CUSTOMER_NUMBER_MAX_LENGTH,
  customerNumberSchema,
} from '../src/index.js';
import { firstMessage, parsedValue } from './lib/validation.helper.js';

/**
 * Unit tests of `customerNumberSchema` (AIS-16).
 *
 * The number is **generated** by the server (`AIS-YYYYMM-NNN`), so the only job
 * of this schema is to keep a malformed value out of the contract: a lower-case
 * prefix, a five-digit month or a two-digit sequence must never reach a client
 * that expects the documented shape.
 *
 * The max length is asserted through the exported constant, so growing the
 * format in AIS-18 cannot leave the limit behind.
 */

describe('customerNumberSchema', () => {
  it('accepts a generated number', () => {
    expect(parsedValue(customerNumberSchema, 'AIS-202611-001')).toBe(
      'AIS-202611-001',
    );
  });

  it('accepts the highest sequence of a month', () => {
    expect(parsedValue(customerNumberSchema, 'AIS-202611-999')).toBe(
      'AIS-202611-999',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(parsedValue(customerNumberSchema, '  AIS-202611-001 ')).toBe(
      'AIS-202611-001',
    );
  });

  it('has the documented maximum length', () => {
    expect(CUSTOMER_NUMBER_MAX_LENGTH).toBe('AIS-202611-001'.length);
  });

  it('rejects a missing prefix', () => {
    expect(firstMessage(customerNumberSchema, '202611-001')).not.toBeNull();
  });

  it('rejects a lower-case prefix', () => {
    expect(firstMessage(customerNumberSchema, 'ais-202611-001')).not.toBeNull();
  });

  it('rejects a five-digit year-month part', () => {
    expect(firstMessage(customerNumberSchema, 'AIS-20261-001')).not.toBeNull();
  });

  it('rejects a seven-digit year-month part', () => {
    expect(firstMessage(customerNumberSchema, 'AIS-2026110-001')).not.toBeNull();
  });

  it('rejects a two-digit sequence', () => {
    expect(firstMessage(customerNumberSchema, 'AIS-202611-01')).not.toBeNull();
  });

  it('rejects a sequence with letters', () => {
    expect(firstMessage(customerNumberSchema, 'AIS-202611-01A')).not.toBeNull();
  });

  it('rejects an empty value', () => {
    expect(firstMessage(customerNumberSchema, '')).not.toBeNull();
  });
});
