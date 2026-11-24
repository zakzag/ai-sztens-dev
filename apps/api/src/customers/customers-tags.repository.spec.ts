import {
  TagNameRaceError,
  TagRowMissingError,
} from './customers-tags.errors.js';
import { DrizzleCustomerTagsRepository } from './customers-tags.repository.js';
import {
  TAG_ID,
  TAGS_CUSTOMER_ID,
  buildTagRow,
  createTagsDatabaseMock,
  type TagsDatabaseMockOptions,
} from './test/mocks/customers-tags.mock.js';

/**
 * Unit tests of the tag persistence (AIS-178, slice e).
 *
 * The `Database` is doubled (no socket), and the assertions are **contract level**:
 * which payload was inserted, whether a link change was reported, and which
 * failures become domain errors. Drizzle's internal call order is never asserted —
 * a chainable mock that proves `insert(customer_tags)` used `ON CONFLICT DO
 * NOTHING` would be testing the ORM, not this repository.
 */

/**
 * @param options - scripted rows/errors for the double.
 * @returns the repository under test plus its double.
 */
function createRepository(options: TagsDatabaseMockOptions = {}): {
  readonly repository: DrizzleCustomerTagsRepository;
  readonly mock: ReturnType<typeof createTagsDatabaseMock>;
} {
  const mock = createTagsDatabaseMock(options);

  return { repository: new DrizzleCustomerTagsRepository(mock.db), mock };
}

describe('DrizzleCustomerTagsRepository — reads', () => {
  it('reports a live customer', async () => {
    const { repository, mock } = createRepository({
      customerRows: [{ id: TAGS_CUSTOMER_ID }],
    });

    await expect(repository.customerExists(TAGS_CUSTOMER_ID)).resolves.toBe(
      true,
    );
    expect(mock.selectExpressions).toHaveLength(1);
  });

  it('reports an unknown customer', async () => {
    const { repository } = createRepository({ customerRows: [] });

    await expect(repository.customerExists(TAGS_CUSTOMER_ID)).resolves.toBe(
      false,
    );
  });

  it('reads a catalogue row by its name', async () => {
    const row = buildTagRow();
    const { repository } = createRepository({ tagRows: [row] });

    await expect(repository.findTagByName('vip')).resolves.toEqual(row);
  });

  it('returns null when the catalogue has no such label', async () => {
    const { repository } = createRepository({ tagRows: [] });

    await expect(repository.findTagByName('vip')).resolves.toBeNull();
  });

  it('reads a catalogue row by its id', async () => {
    const row = buildTagRow({ isActive: false });
    const { repository } = createRepository({ tagRows: [row] });

    await expect(repository.findTagById(TAG_ID)).resolves.toEqual(row);
  });
});

describe('DrizzleCustomerTagsRepository — insertTag', () => {
  it('inserts the mapped payload and returns the stored row', async () => {
    const row = buildTagRow();
    const { repository, mock } = createRepository({ insertedTagRows: [row] });

    await expect(
      repository.insertTag(mock.tx, { name: 'vip', isActive: true }),
    ).resolves.toEqual(row);
    expect(mock.insertedTagValues).toEqual([{ name: 'vip', isActive: true }]);
  });

  it('maps a tags_name_key violation to TagNameRaceError', async () => {
    const { repository, mock } = createRepository({
      insertError: { code: '23505', constraint_name: 'tags_name_key' },
    });

    const error = await repository
      .insertTag(mock.tx, { name: 'vip', isActive: true })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TagNameRaceError);
    expect((error as TagNameRaceError).tagName).toBe('vip');
  });

  it('rethrows any other failure untouched', async () => {
    const driverError = new Error('permission denied for table tags');
    const { repository, mock } = createRepository({ insertError: driverError });

    await expect(
      repository.insertTag(mock.tx, { name: 'vip', isActive: true }),
    ).rejects.toBe(driverError);
  });

  it('fails loudly when RETURNING yields no row', async () => {
    const { repository, mock } = createRepository({ insertedTagRows: [] });

    await expect(
      repository.insertTag(mock.tx, { name: 'vip', isActive: true }),
    ).rejects.toBeInstanceOf(TagRowMissingError);
  });
});

describe('DrizzleCustomerTagsRepository — link writes', () => {
  it('reports a link it created', async () => {
    const { repository, mock } = createRepository({ linked: true });

    await expect(
      repository.attach(mock.tx, TAGS_CUSTOMER_ID, TAG_ID),
    ).resolves.toBe(true);
    expect(mock.attachedValues).toEqual([
      { customerId: TAGS_CUSTOMER_ID, tagId: TAG_ID },
    ]);
  });

  it('reports an already present link as a no-op', async () => {
    const { repository, mock } = createRepository({ linked: false });

    await expect(
      repository.attach(mock.tx, TAGS_CUSTOMER_ID, TAG_ID),
    ).resolves.toBe(false);
  });

  it('reports a link it removed', async () => {
    const { repository, mock } = createRepository({ detached: true });

    await expect(
      repository.detach(mock.tx, TAGS_CUSTOMER_ID, TAG_ID),
    ).resolves.toBe(true);
    expect(mock.deleteExpressions).toHaveLength(1);
  });

  it('reports a missing link', async () => {
    const { repository, mock } = createRepository({ detached: false });

    await expect(
      repository.detach(mock.tx, TAGS_CUSTOMER_ID, TAG_ID),
    ).resolves.toBe(false);
  });
});

describe('DrizzleCustomerTagsRepository — runInTransaction', () => {
  it('runs the work on the transaction handle', async () => {
    const { repository, mock } = createRepository();

    await expect(
      repository.runInTransaction((tx) => Promise.resolve(tx)),
    ).resolves.toBe(mock.tx);
  });
});
