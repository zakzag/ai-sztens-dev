import {
  AUDIT_REQUEST_ID_MAX_LENGTH,
  AUDIT_USER_AGENT_MAX_LENGTH,
} from '@callback/shared';
import { toAuditRequestFacts, toIpAddress } from './audit-request.logic.js';

/**
 * Unit tests for the request-facts extraction (AIS-177).
 *
 * The interesting cases are the unusable ones: an `inet` column rejects a proxy
 * list, and a rejected insert would roll the business write back with it. So a
 * value we cannot store honestly must become `null` here, not an error later.
 */
describe('toIpAddress', () => {
  it('accepts an IPv4 literal', () => {
    expect(toIpAddress('10.1.2.3')).toBe('10.1.2.3');
  });

  it('accepts an IPv6 literal and the IPv4-mapped form', () => {
    expect(toIpAddress('2001:db8::1')).toBe('2001:db8::1');
    expect(toIpAddress('::ffff:127.0.0.1')).toBe('::ffff:127.0.0.1');
  });

  it('trims surrounding whitespace', () => {
    expect(toIpAddress('  10.1.2.3  ')).toBe('10.1.2.3');
  });

  it('rejects a forwarded list, which is not a single address', () => {
    expect(toIpAddress('10.1.2.3, 10.1.2.4')).toBeNull();
  });

  it('rejects a non-literal placeholder', () => {
    expect(toIpAddress('unknown')).toBeNull();
    expect(toIpAddress('<unknown>')).toBeNull();
  });

  it('rejects an over-long candidate', () => {
    expect(toIpAddress('a'.repeat(46))).toBeNull();
  });

  it('rejects non-strings and blanks', () => {
    expect(toIpAddress(undefined)).toBeNull();
    expect(toIpAddress(42)).toBeNull();
    expect(toIpAddress('   ')).toBeNull();
  });
});

describe('toAuditRequestFacts', () => {
  it('collects the ip, the user agent, the request id and the admin source', () => {
    const facts = toAuditRequestFacts(
      {
        headers: { 'user-agent': 'Mozilla/5.0 (test)' },
        ip: '10.1.2.3',
      },
      'req-abc-123',
    );

    expect(facts).toEqual({
      ipAddress: '10.1.2.3',
      userAgent: 'Mozilla/5.0 (test)',
      requestId: 'req-abc-123',
      source: 'admin_api',
    });
  });

  it('reads the user agent case-insensitively', () => {
    const facts = toAuditRequestFacts(
      { headers: { 'User-Agent': 'curl/8' }, ip: '127.0.0.1' },
      'req-1',
    );

    expect(facts.userAgent).toBe('curl/8');
  });

  it('takes the first value of a repeated header', () => {
    const facts = toAuditRequestFacts(
      { headers: { 'user-agent': ['first/1', 'second/2'] }, ip: '127.0.0.1' },
      'req-1',
    );

    expect(facts.userAgent).toBe('first/1');
  });

  it('clips the user agent to the contract limit', () => {
    const facts = toAuditRequestFacts(
      {
        headers: { 'user-agent': 'u'.repeat(AUDIT_USER_AGENT_MAX_LENGTH + 50) },
        ip: null,
      },
      'req-1',
    );

    expect(facts.userAgent).toHaveLength(AUDIT_USER_AGENT_MAX_LENGTH);
  });

  it('clips the request id to the contract limit', () => {
    const facts = toAuditRequestFacts(
      { headers: {}, ip: null },
      'r'.repeat(AUDIT_REQUEST_ID_MAX_LENGTH + 10),
    );

    expect(facts.requestId).toHaveLength(AUDIT_REQUEST_ID_MAX_LENGTH);
  });

  it('maps every missing fact to null', () => {
    const facts = toAuditRequestFacts(
      { headers: {}, ip: undefined },
      undefined,
    );

    expect(facts).toEqual({
      ipAddress: null,
      userAgent: null,
      requestId: null,
      source: 'admin_api',
    });
  });

  it('ignores a blank header and a blank correlation id', () => {
    const facts = toAuditRequestFacts(
      { headers: { 'user-agent': '   ' }, ip: '127.0.0.1' },
      '   ',
    );

    expect(facts.userAgent).toBeNull();
    expect(facts.requestId).toBeNull();
  });

  it('accepts an explicit source override', () => {
    const facts = toAuditRequestFacts(
      { headers: {}, ip: null },
      'req-1',
      'worker',
    );

    expect(facts.source).toBe('worker');
  });
});
