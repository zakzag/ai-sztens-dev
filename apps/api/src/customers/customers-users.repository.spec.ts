import {
  CustomerOwnerConflictError,
  CustomerUserEmailConflictError,
  CustomerUserInUseError,
  CustomerUserRowMissingError,
} from './customers-users.errors.js';
import { DrizzleCustomerUsersRepository } from './customers-users.repository.js';
import {
  CUSTOMER_USER_ID,
  USERS_CUSTOMER_ID,
  USER_UPDATED_AT,
  buildCustomerUserRowFixture,
  createUsersDatabaseMock,
  type UsersDatabaseMockOptions,
} from './test/mocks/customers-users.mock.js';

/**
 * Unit tests of the customer-user persistence (AIS-178, slice e).
 *
 * The `Database` is doubled (no socket) and the assertions are **contract level**:
 * which payload was written, whether the guarded update carried the expected
 * version, and which constraint becomes which domain error. Every other failure is
 * asserted to pass through untouched — that is what keeps a permissions problem a
 * `500` instead of a fabricated `409`.
 */

/**
 * @param options - scripted rows/errors for the double.
 * @returns the repository under test plus its double.
 */
function createRepository(options: UsersDatabaseMockOptions = {}): {
  readonly repository: DrizzleCustomerUsersRepository;
  readonly mock: ReturnType<typeof createUsersDatabaseMock>;
} {
  const mock = createUsersDatabaseMock(options);

  return { repository: new DrizzleCustomerUsersRepository(mock.db), mock };
}

describe('DrizzleCustomerUsersRepository — reads', () => {
  it('reports a live customer', async () => {
    const { repository } = createRepository({
      customerRows: [{ id: USERS_CUSTOMER_ID }],
    });

    await expect(repository.customerExists(USERS_CUSTOMER_ID)).resolves.toBe(
      true,
    );
  });

  it('reports an unknown customer', async () => {
    const { repository } = createRepository({ customerRows: [] });

    await expect(repository.customerExists(USERS_CUSTOMER_ID)).resolves.toBe(
      false,
    );
  });

  it('reads one login user of the customer', async () => {
    const row = buildCustomerUserRowFixture();
    const { repository } = createRepository({ userRows: [row] });

    await expect(
      repository.findById(USERS_CUSTOMER_ID, CUSTOMER_USER_ID),
    ).resolves.toEqual(row);
  });

  it('returns null for a user of another customer', async () => {
    const { repository } = createRepository({ userRows: [] });

    await expect(
      repository.findById(USERS_CUSTOMER_ID, CUSTOMER_USER_ID),
    ).resolves.toBeNull();
  });
});

describe('DrizzleCustomerUsersRepository — insert', () => {
  it('writes the mapped payload and returns the stored row', async () => {
    const row = buildCustomerUserRowFixture();
    const { repository, mock } = createRepository({ insertedRows: [row] });

    const result = await repository.insert(mock.tx, {
      customerId: USERS_CUSTOMER_ID,
      name: 'Kiss Péter',
      email: 'peter.kiss@pelda.hu',
      passwordHash: null,
      role: 'member',
      status: 'invited',
      invitedByOperatorId: null,
      invitedAt: USER_UPDATED_AT,
      acceptedAt: null,
      lastLoginAt: null,
    });

    expect(result).toEqual(row);
    expect(mock.insertedValues[0]?.email).toBe('peter.kiss@pelda.hu');
  });

  it('maps the global e-mail index to CustomerUserEmailConflictError', async () => {
    const { repository, mock } = createRepository({
      insertError: {
        code: '23505',
        constraint_name: 'customer_users_email_key',
      },
    });

    const error = await repository
      .insert(mock.tx, {
        customerId: USERS_CUSTOMER_ID,
        name: 'Kiss Péter',
        email: 'peter.kiss@pelda.hu',
        role: 'member',
        status: 'invited',
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CustomerUserEmailConflictError);
    expect((error as CustomerUserEmailConflictError).email).toBe(
      'peter.kiss@pelda.hu',
    );
  });

  it('rethrows any other failure untouched', async () => {
    const driverError = new Error('permission denied for table customer_users');
    const { repository, mock } = createRepository({ insertError: driverError });

    await expect(
      repository.insert(mock.tx, {
        customerId: USERS_CUSTOMER_ID,
        name: 'Kiss Péter',
        email: 'peter.kiss@pelda.hu',
        role: 'member',
        status: 'invited',
      }),
    ).rejects.toBe(driverError);
  });

  it('fails loudly when RETURNING yields no row', async () => {
    const { repository, mock } = createRepository({ insertedRows: [] });

    await expect(
      repository.insert(mock.tx, {
        customerId: USERS_CUSTOMER_ID,
        name: 'Kiss Péter',
        email: 'peter.kiss@pelda.hu',
        role: 'member',
        status: 'invited',
      }),
    ).rejects.toBeInstanceOf(CustomerUserRowMissingError);
  });
});

describe('DrizzleCustomerUsersRepository — updateById', () => {
  it('writes the patch through a version-guarded statement', async () => {
    const { repository, mock } = createRepository();

    const row = await repository.updateById(
      mock.tx,
      USERS_CUSTOMER_ID,
      CUSTOMER_USER_ID,
      { status: 'active' },
      USER_UPDATED_AT,
    );

    expect(row?.status).toBe('active');
    expect(mock.updateSetValues).toEqual([{ status: 'active' }]);
    expect(mock.updateExpressions).toHaveLength(1);
  });

  it('returns null when nothing matched (stale token)', async () => {
    const { repository, mock } = createRepository({ updatedRows: [] });

    await expect(
      repository.updateById(
        mock.tx,
        USERS_CUSTOMER_ID,
        CUSTOMER_USER_ID,
        { status: 'active' },
        USER_UPDATED_AT,
      ),
    ).resolves.toBeNull();
  });

  it('maps the partial owner index to CustomerOwnerConflictError', async () => {
    const { repository, mock } = createRepository({
      updateError: {
        code: '23505',
        constraint_name: 'customer_users_customer_owner_key',
      },
    });

    await expect(
      repository.updateById(
        mock.tx,
        USERS_CUSTOMER_ID,
        CUSTOMER_USER_ID,
        { role: 'owner', status: 'active' },
        USER_UPDATED_AT,
      ),
    ).rejects.toBeInstanceOf(CustomerOwnerConflictError);
  });

  it('rethrows an unrelated failure untouched', async () => {
    const driverError = new Error('connection terminated');
    const { repository, mock } = createRepository({ updateError: driverError });

    await expect(
      repository.updateById(
        mock.tx,
        USERS_CUSTOMER_ID,
        CUSTOMER_USER_ID,
        { name: 'Új Név' },
        USER_UPDATED_AT,
      ),
    ).rejects.toBe(driverError);
  });
});

describe('DrizzleCustomerUsersRepository — deleteById', () => {
  it('returns the removed row', async () => {
    const { repository, mock } = createRepository();
    const row = await repository.deleteById(
      mock.tx,
      USERS_CUSTOMER_ID,
      CUSTOMER_USER_ID,
    );

    expect(row?.id).toBe(CUSTOMER_USER_ID);
    expect(mock.deleteExpressions).toHaveLength(1);
  });

  it('returns null when no row matched', async () => {
    const { repository, mock } = createRepository({ deletedRows: [] });

    await expect(
      repository.deleteById(mock.tx, USERS_CUSTOMER_ID, CUSTOMER_USER_ID),
    ).resolves.toBeNull();
  });

  it('maps a referencing foreign key to CustomerUserInUseError', async () => {
    const { repository, mock } = createRepository({
      deleteError: {
        code: '23503',
        constraint_name: 'contacts_customer_user_id_fkey',
      },
    });

    await expect(
      repository.deleteById(mock.tx, USERS_CUSTOMER_ID, CUSTOMER_USER_ID),
    ).rejects.toBeInstanceOf(CustomerUserInUseError);
  });

  it('rethrows an unrelated failure untouched', async () => {
    const driverError = new Error('permission denied for table customer_users');
    const { repository, mock } = createRepository({ deleteError: driverError });

    await expect(
      repository.deleteById(mock.tx, USERS_CUSTOMER_ID, CUSTOMER_USER_ID),
    ).rejects.toBe(driverError);
  });
});

describe('DrizzleCustomerUsersRepository — runInTransaction', () => {
  it('runs the work on the transaction handle', async () => {
    const { repository, mock } = createRepository();

    await expect(
      repository.runInTransaction((tx) => Promise.resolve(tx)),
    ).resolves.toBe(mock.tx);
  });
});
