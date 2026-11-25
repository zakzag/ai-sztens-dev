/**
 * Tests of the activity-feed mapper (AIS-181).
 *
 * Two rules are the reason this file exists: the type → label/variant table must be
 * total over the closed union, and `canEdit` may be true **only** for an
 * operator-authored entry (`D-W4`). The concurrency token is the third: it is
 * `updatedAt ?? createdAt`, so the first edit of a never-edited entry cannot be
 * rejected by the server as stale.
 */

import {
  ACTIVITY_TYPE_VALUES,
  VALID_ACTIVITY,
  type Activity,
  type AuthorType,
} from '@callback/shared';
import { describe, expect, it } from 'vitest';
import { formatDateTime } from '../../lib/date.js';
import {
  CUSTOMER_ACTIVITY_TYPE_LABELS,
  CUSTOMER_ACTIVITY_TYPE_VARIANTS,
} from './customer.const.js';
import {
  canEditActivity,
  toActivityUpdateToken,
  toCustomerActivityViewModels,
} from './customer-activity.mapper.js';

/**
 * @param overrides - fields to replace on the fixture row.
 * @returns a complete activity row.
 */
function buildActivity(overrides: Partial<Activity> = {}): Activity {
  return { ...VALID_ACTIVITY, ...overrides };
}

describe('toCustomerActivityViewModels', () => {
  it('maps the label and the badge variant of every kind', () => {
    const rows = ACTIVITY_TYPE_VALUES.map((type) =>
      buildActivity({ type, body: `Bemenet: ${type}` }),
    );

    const viewModels = toCustomerActivityViewModels(rows);

    expect(viewModels).toHaveLength(ACTIVITY_TYPE_VALUES.length);

    for (const [index, type] of ACTIVITY_TYPE_VALUES.entries()) {
      expect(viewModels[index]?.type).toBe(type);
      expect(viewModels[index]?.typeLabel).toBe(CUSTOMER_ACTIVITY_TYPE_LABELS[type]);
      expect(viewModels[index]?.typeVariant).toBe(
        CUSTOMER_ACTIVITY_TYPE_VARIANTS[type],
      );
    }
  });

  it('keeps the server order of the page', () => {
    const viewModels = toCustomerActivityViewModels([
      buildActivity({ id: 'a', body: 'első' }),
      buildActivity({ id: 'b', body: 'második' }),
    ]);

    expect(viewModels.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('formats the creation time instead of passing the raw instant through', () => {
    const [row] = toCustomerActivityViewModels([buildActivity()]);

    expect(row?.createdAtText).toBe(formatDateTime(VALID_ACTIVITY.createdAt));
    expect(row?.createdAtText).not.toBe(VALID_ACTIVITY.createdAt);
  });

  it('passes the author name and the localised author kind through', () => {
    const [row] = toCustomerActivityViewModels([buildActivity()]);

    expect(row?.authorName).toBe(VALID_ACTIVITY.authorName);
    expect(row?.authorTypeText).not.toHaveLength(0);
  });
});

describe('canEditActivity', () => {
  it('allows the edit only for an operator-authored entry', () => {
    expect(canEditActivity('operator')).toBe(true);
  });

  it('refuses every other author kind', () => {
    const otherAuthors: readonly AuthorType[] = [
      'customer_user',
      'system',
      'api_key',
    ];

    for (const authorType of otherAuthors) {
      expect(canEditActivity(authorType)).toBe(false);
    }
  });

  it('is applied by the view-model mapper too', () => {
    const viewModels = toCustomerActivityViewModels([
      buildActivity({ authorType: 'operator' }),
      buildActivity({ authorType: 'system', authorName: 'system' }),
    ]);

    expect(viewModels[0]?.canEdit).toBe(true);
    expect(viewModels[1]?.canEdit).toBe(false);
  });
});

describe('toActivityUpdateToken', () => {
  it('prefers the last write instant', () => {
    const token = toActivityUpdateToken({
      createdAt: '2026-11-23T09:00:00.000Z',
      updatedAt: '2026-11-23T10:00:00.000Z',
    });

    expect(token).toBe('2026-11-23T10:00:00.000Z');
  });

  it('falls back to the creation instant when the entry was never edited', () => {
    const token = toActivityUpdateToken({
      createdAt: '2026-11-23T09:00:00.000Z',
      updatedAt: null,
    });

    expect(token).toBe('2026-11-23T09:00:00.000Z');
  });
});
