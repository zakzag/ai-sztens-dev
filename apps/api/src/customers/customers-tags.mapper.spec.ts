import {
  toCustomerTag,
  toLinkAuditPayload,
  toNewTagRow,
  toTagAuditPayload,
} from './customers-tags.mapper.js';
import {
  TAG_ID,
  TAGS_CUSTOMER_ID,
  buildTagRow,
} from './test/mocks/customers-tags.mock.js';

/**
 * Unit tests of the tag mapping (AIS-178, slice e).
 *
 * Pure functions only: the payload shapes, the insert defaults and the two audit
 * payloads (one for the catalogue row, one for the composite-key link).
 */
describe('toCustomerTag', () => {
  it('maps a tag row to the wire payload', () => {
    expect(toCustomerTag(buildTagRow())).toEqual({
      id: TAG_ID,
      name: 'vip',
      isActive: true,
    });
  });

  it('keeps an inactive label as it is', () => {
    expect(toCustomerTag(buildTagRow({ isActive: false })).isActive).toBe(
      false,
    );
  });
});

describe('toNewTagRow', () => {
  it('creates an active label', () => {
    expect(toNewTagRow('vip')).toEqual({ name: 'vip', isActive: true });
  });
});

describe('toTagAuditPayload', () => {
  it('carries the business columns of the catalogue row', () => {
    expect(toTagAuditPayload(buildTagRow())).toEqual({
      id: TAG_ID,
      name: 'vip',
      isActive: true,
    });
  });
});

describe('toLinkAuditPayload', () => {
  it('carries the composite key pair', () => {
    expect(toLinkAuditPayload(TAGS_CUSTOMER_ID, TAG_ID)).toEqual({
      customerId: TAGS_CUSTOMER_ID,
      tagId: TAG_ID,
    });
  });
});
