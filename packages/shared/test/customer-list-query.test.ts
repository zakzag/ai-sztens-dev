import {
  CUSTOMER_DEFAULT_SORT,
  CUSTOMER_LIST_QUERY_PARAMETERS,
  CUSTOMER_SORT_FIELDS,
  VALIDATION_MESSAGE_CATALOGUE,
  customerListQuerySchema,
} from '../src/index.js';
import { firstMessage, parsedValue } from './lib/validation.helper.js';

/**
 * Unit tests of `customerListQuerySchema` (AIS-16).
 *
 * The query string is always text, so the interesting behaviour is: the shared
 * defaults are filled in, numbers are coerced, an unknown `sort` is a validation
 * error naming the permitted columns (not a `500` from Postgres), and each of
 * the three customer-specific filters is optional.
 */

describe('customerListQuerySchema', () => {
  it('fills the shared paging defaults', () => {
    const query = parsedValue(customerListQuerySchema, {});

    expect(query).toMatchObject({
      page: 1,
      limit: 20,
      order: 'desc',
      sort: CUSTOMER_DEFAULT_SORT,
    });
  });

  it('leaves every filter unset when the request does not name one', () => {
    const query = parsedValue(customerListQuerySchema, {});

    expect(query?.type).toBeUndefined();
    expect(query?.status).toBeUndefined();
    expect(query?.source).toBeUndefined();
  });

  it('coerces page and limit from the query string', () => {
    const query = parsedValue(customerListQuerySchema, {
      page: '3',
      limit: '50',
    });

    expect(query?.page).toBe(3);
    expect(query?.limit).toBe(50);
  });

  it('accepts every sortable column', () => {
    for (const sort of CUSTOMER_SORT_FIELDS) {
      expect(customerListQuerySchema.safeParse({ sort }).success).toBe(true);
    }
  });

  it('rejects an unknown sort column with the shared format copy', () => {
    // The validation error map translates zod's `invalid_enum_value` into the
    // same INVALID_FORMAT sentence every other format failure produces, so the
    // assertion is about *the catalogue*, not zod's internal wording.
    expect(firstMessage(customerListQuerySchema, { sort: 'modules' })).toBe(
      VALIDATION_MESSAGE_CATALOGUE.en.INVALID_FORMAT,
    );
  });

  it('accepts the three customer filters together', () => {
    const query = parsedValue(customerListQuerySchema, {
      type: 'company',
      status: 'active',
      source: 'website',
    });

    expect(query?.type).toBe('company');
    expect(query?.status).toBe('active');
    expect(query?.source).toBe('website');
  });

  it('rejects an unknown status filter', () => {
    expect(
      customerListQuerySchema.safeParse({ status: 'archived' }).success,
    ).toBe(false);
  });

  it('rejects an unknown source filter', () => {
    expect(
      customerListQuerySchema.safeParse({ source: 'billboard' }).success,
    ).toBe(false);
  });

  it('strips the retired responsibleOperatorId filter instead of validating it', () => {
    // The column and the filter were removed in 2026-11-24: a bookmarked link or
    // an older client must be ignored like any other unknown key, not answered
    // with a `400` that says nothing about the removed feature.
    const parsed = customerListQuerySchema.safeParse({
      responsibleOperatorId: 'kalman',
    });

    expect(parsed.success).toBe(true);
    expect(
      Object.hasOwn(parsed.success ? parsed.data : {}, 'responsibleOperatorId'),
    ).toBe(false);
  });

  it('trims the search term', () => {
    expect(parsedValue(customerListQuerySchema, { q: '  Kft  ' })?.q).toBe('Kft');
  });

  it('turns an empty search term into no filter at all', () => {
    expect(parsedValue(customerListQuerySchema, { q: '   ' })?.q).toBeUndefined();
  });
});

describe('CUSTOMER_LIST_QUERY_PARAMETERS', () => {
  it('documents the paging fields, the sort and the three filters', () => {
    const names = CUSTOMER_LIST_QUERY_PARAMETERS.map((parameter) => parameter.name);

    expect(names).toEqual([
      'page',
      'limit',
      'sort',
      'order',
      'q',
      'type',
      'status',
      'source',
    ]);
  });

  it('documents the default sort of the schema', () => {
    const sort = CUSTOMER_LIST_QUERY_PARAMETERS.find(
      (parameter) => parameter.name === 'sort',
    );

    expect(sort?.schema.default).toBe(CUSTOMER_DEFAULT_SORT);
  });
});
