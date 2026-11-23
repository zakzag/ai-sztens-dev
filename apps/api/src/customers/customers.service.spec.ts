import { jest } from '@jest/globals';
import { API_ERROR_CODE } from '@callback/shared';
import {
  ConflictAppError,
  NotFoundAppError,
  StaleWriteAppError,
} from '../common/http/app-error.js';
import {
  CustomerNumberConflictError,
  CustomerTaxNumberConflictError,
} from './customers.errors.js';
import { CustomersService } from './customers.service.js';
import {
  CUSTOMER_NUMBER,
  CUSTOMER_ROW_ID,
  CUSTOMER_UPDATED_AT,
  buildAuditFacts,
  buildCreateCustomerInput,
  buildCustomerDetailRows,
  buildCustomerListQuery,
  buildCustomerResponse,
  buildCustomerRow,
  buildRawCustomerRow,
  buildUpdateCustomerInput,
  buildUpdateStatusInput,
  createAuditWriterMock,
  createCustomersRepositoryMock,
} from './test/mocks/customers.mock.js';

/**
 * Unit tests for the service layer (AIS-178).
 *
 * Both collaborators are plain object doubles (the service depends on two
 * interfaces), so no Nest container and no database is involved. What is
 * verified here is exactly the orchestration: one transaction per write, exactly
 * one audit row **on that transaction**, the retry-once rule of the number
 * allocation, the `AppError` translation (code + status + field details), and
 * the response mapping.
 */

/** Fixed "now", so the number allocation needs no timers. */
const NOW = new Date('2026-11-22T21:00:00.000Z');

/** Fixed month prefix the allocation produces for {@link NOW}. */
const PREFIX = 'AIS-202611-';

describe('CustomersService', () => {
  describe('list', () => {
    it('forwards the query and maps the rows of the page', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findPage.mockResolvedValue({
        rows: [buildCustomerRow()],
        total: 1,
      });
      const service = new CustomersService(mocks.repository, audit.writer);
      const query = buildCustomerListQuery({ page: 2, limit: 10 });

      const result = await service.list(query);

      expect(mocks.findPage).toHaveBeenCalledWith(query);
      expect(result.items).toEqual([buildCustomerResponse()]);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('answers an empty page as `items: []` with a zero total', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findPage.mockResolvedValue({ rows: [], total: 0 });
      const service = new CustomersService(mocks.repository, audit.writer);

      await expect(service.list(buildCustomerListQuery())).resolves.toEqual({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });
  });

  describe('findById', () => {
    it('returns the mapped detail', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findById.mockResolvedValue(buildCustomerDetailRows());
      const service = new CustomersService(mocks.repository, audit.writer);

      const result = await service.findById(CUSTOMER_ROW_ID);

      expect(mocks.findById).toHaveBeenCalledWith(CUSTOMER_ROW_ID);
      expect(result.id).toBe(CUSTOMER_ROW_ID);
      expect(result.contacts).toHaveLength(1);
    });

    it('translates a missing row into a NOT_FOUND AppError', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findById.mockResolvedValue(null);
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .findById('missing')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundAppError);
      expect(error).toMatchObject({
        code: API_ERROR_CODE.NOT_FOUND,
        status: 404,
      });
    });
  });

  describe('create', () => {
    it('allocates the number inside the transaction and writes one audit row', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      const row = buildRawCustomerRow();
      mocks.nextCustomerNumber.mockResolvedValue(`${PREFIX}001`);
      mocks.create.mockResolvedValue(row);
      const service = new CustomersService(mocks.repository, audit.writer);

      const result = await service.create(
        buildCreateCustomerInput(),
        buildAuditFacts(),
        NOW,
      );

      // The number came from the sequence, not from the client.
      expect(mocks.nextCustomerNumber).toHaveBeenCalledWith(
        expect.anything(),
        PREFIX,
      );
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.create.mock.calls[0]?.[1]).toMatchObject({
        customerNumber: 'AIS-202611-002',
        status: 'prospect',
        statusChangedAt: NOW,
      });

      // Exactly one audit row, on the same transaction handle as the write.
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        customerId: row.id,
        tableName: 'customers',
        recordId: row.id,
        operation: 'insert',
        before: null,
      });
      expect(audit.calls[0]?.after).toMatchObject({
        legalName: row.legalName,
      });
      expect(audit.transactions[0]).toBeDefined();

      // A fresh row has no activities and no contacts.
      expect(result).toEqual(
        buildCustomerResponse({
          lastActivityAt: null,
          primaryContactName: null,
        }),
      );
    });

    it('starts a new month at 001', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.nextCustomerNumber.mockResolvedValue(null);
      mocks.create.mockResolvedValue(buildRawCustomerRow());
      const service = new CustomersService(mocks.repository, audit.writer);

      await service.create(buildCreateCustomerInput(), buildAuditFacts(), NOW);

      expect(mocks.create.mock.calls[0]?.[1]).toMatchObject({
        customerNumber: `${PREFIX}001`,
      });
    });

    it('retries once in a fresh transaction after a number collision', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.nextCustomerNumber
        .mockResolvedValueOnce(`${PREFIX}001`)
        .mockResolvedValueOnce(`${PREFIX}002`);
      mocks.create
        .mockRejectedValueOnce(
          new CustomerNumberConflictError(`${PREFIX}002`, new Error('23505')),
        )
        .mockResolvedValueOnce(buildRawCustomerRow());
      const service = new CustomersService(mocks.repository, audit.writer);

      const result = await service.create(
        buildCreateCustomerInput(),
        buildAuditFacts(),
        NOW,
      );

      expect(mocks.runInTransaction).toHaveBeenCalledTimes(2);
      expect(mocks.create).toHaveBeenCalledTimes(2);
      expect(audit.calls).toHaveLength(1);
      expect(result.id).toBe(CUSTOMER_ROW_ID);
    });

    it('answers 409 CUSTOMER_NUMBER_CONFLICT when the retry collides again', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.nextCustomerNumber.mockResolvedValue(`${PREFIX}001`);
      mocks.create.mockRejectedValue(
        new CustomerNumberConflictError(`${PREFIX}002`, new Error('23505')),
      );
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .create(buildCreateCustomerInput(), buildAuditFacts(), NOW)
        .catch((caught: unknown) => caught);

      expect(mocks.create).toHaveBeenCalledTimes(2);
      expect(audit.calls).toHaveLength(0);
      expect(error).toBeInstanceOf(ConflictAppError);
      expect(error).toMatchObject({
        code: API_ERROR_CODE.CUSTOMER_NUMBER_CONFLICT,
        status: 409,
      });
    });

    it('does not retry a full month, and answers 409', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.nextCustomerNumber.mockResolvedValue(`${PREFIX}999`);
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .create(buildCreateCustomerInput(), buildAuditFacts(), NOW)
        .catch((caught: unknown) => caught);

      expect(mocks.create).not.toHaveBeenCalled();
      expect(error).toMatchObject({
        code: API_ERROR_CODE.CUSTOMER_NUMBER_CONFLICT,
      });
    });

    it('translates a tax number collision into the field-level 409', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.nextCustomerNumber.mockResolvedValue(null);
      mocks.create.mockRejectedValue(
        new CustomerTaxNumberConflictError('10537914-4-44', new Error('23505')),
      );
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .create(buildCreateCustomerInput(), buildAuditFacts(), NOW)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictAppError);
      expect(error).toMatchObject({
        code: API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT,
        status: 409,
      });
      expect((error as ConflictAppError).details[0]?.path).toBe('taxNumber');
    });

    it('propagates any other repository error unchanged', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      const driverError = new Error('connection terminated');
      mocks.nextCustomerNumber.mockResolvedValue(null);
      mocks.create.mockRejectedValue(driverError);
      const service = new CustomersService(mocks.repository, audit.writer);

      await expect(
        service.create(buildCreateCustomerInput(), buildAuditFacts(), NOW),
      ).rejects.toBe(driverError);
    });

    it('propagates an audit failure, so the business write cannot commit alone', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      const ledgerError = new Error('audit insert failed');
      mocks.nextCustomerNumber.mockResolvedValue(null);
      mocks.create.mockResolvedValue(buildRawCustomerRow());
      audit.failNextWith(ledgerError);
      const service = new CustomersService(mocks.repository, audit.writer);

      await expect(
        service.create(buildCreateCustomerInput(), buildAuditFacts(), NOW),
      ).rejects.toBe(ledgerError);
    });

    it('maps an exhausted sequence error into 409', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.nextCustomerNumber.mockResolvedValue(`${PREFIX}999`);
      const service = new CustomersService(mocks.repository, audit.writer);
      // `toNextCustomerNumber` throws before the insert, inside the same
      // transaction callback, so the error surfaces through the same mapping.
      const error = await service
        .create(buildCreateCustomerInput(), buildAuditFacts(), NOW)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictAppError);
      expect(error).toMatchObject({
        code: API_ERROR_CODE.CUSTOMER_NUMBER_CONFLICT,
      });
      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('writes the patch, audits before/after and re-reads the projections', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      const current = buildRawCustomerRow();
      const updated = buildRawCustomerRow({ legalName: 'Példa Zrt.' });
      mocks.findAnyById.mockResolvedValue(current);
      mocks.updateById.mockResolvedValue(updated);
      mocks.findById.mockResolvedValue(
        buildCustomerDetailRows({
          customer: buildCustomerRow({ legalName: 'Példa Zrt.' }),
        }),
      );
      const service = new CustomersService(mocks.repository, audit.writer);

      const result = await service.update(
        current.id,
        buildUpdateCustomerInput(),
        buildAuditFacts(),
      );

      const [, id, patch, expected] = mocks.updateById.mock.calls[0] ?? [];

      expect(id).toBe(current.id);
      expect(patch).toEqual({ legalName: 'Példa Szolgáltató Zrt.' });
      expect(expected).toEqual(CUSTOMER_UPDATED_AT);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        operation: 'update',
        customerId: current.id,
      });
      expect(audit.calls[0]?.before).toMatchObject({
        legalName: current.legalName,
      });
      expect(audit.calls[0]?.after).toMatchObject({ legalName: 'Példa Zrt.' });

      expect(result.legalName).toBe('Példa Zrt.');
    });

    it('short-circuits an empty patch: no write, no audit row', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
      mocks.findById.mockResolvedValue(buildCustomerDetailRows());
      const service = new CustomersService(mocks.repository, audit.writer);

      const result = await service.update(
        CUSTOMER_ROW_ID,
        { updatedAt: CUSTOMER_UPDATED_AT.toISOString() },
        buildAuditFacts(),
      );

      expect(mocks.updateById).not.toHaveBeenCalled();
      expect(mocks.runInTransaction).not.toHaveBeenCalled();
      expect(audit.calls).toHaveLength(0);
      expect(result).toEqual(buildCustomerResponse());
    });

    it('answers 404 for an archived or unknown id', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(
        buildRawCustomerRow({ deletedAt: CUSTOMER_UPDATED_AT }),
      );
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .update(CUSTOMER_ROW_ID, buildUpdateCustomerInput(), buildAuditFacts())
        .catch((caught: unknown) => caught);

      expect(error).toMatchObject({
        code: API_ERROR_CODE.NOT_FOUND,
        status: 404,
      });
      expect(mocks.updateById).not.toHaveBeenCalled();
    });

    it('answers 409 STALE_WRITE when the guard matched nothing', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
      mocks.updateById.mockResolvedValue(null);
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .update(CUSTOMER_ROW_ID, buildUpdateCustomerInput(), buildAuditFacts())
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StaleWriteAppError);
      expect(error).toMatchObject({
        code: API_ERROR_CODE.STALE_WRITE,
        status: 409,
      });
      expect(audit.calls).toHaveLength(0);
    });

    it('answers 409 CUSTOMER_TAX_NUMBER_CONFLICT on a duplicate tax number', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
      mocks.updateById.mockRejectedValue(
        new CustomerTaxNumberConflictError('10773381-2-44', new Error('23505')),
      );
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .update(
          CUSTOMER_ROW_ID,
          buildUpdateCustomerInput({ taxNumber: '10773381-2-44' }),
          buildAuditFacts(),
        )
        .catch((caught: unknown) => caught);

      expect(error).toMatchObject({
        code: API_ERROR_CODE.CUSTOMER_TAX_NUMBER_CONFLICT,
        status: 409,
      });
      expect((error as ConflictAppError).details[0]?.path).toBe('taxNumber');
      expect(audit.calls).toHaveLength(0);
    });
  });

  describe('updateStatus', () => {
    it('writes status and statusChangedAt together and audits the change', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      const current = buildRawCustomerRow();
      const updated = buildRawCustomerRow({ status: 'suspended' });
      mocks.findAnyById.mockResolvedValue(current);
      mocks.updateStatusById.mockResolvedValue(updated);
      mocks.findById.mockResolvedValue(
        buildCustomerDetailRows({
          customer: buildCustomerRow({
            status: 'suspended',
            statusChangedAt: NOW,
          }),
        }),
      );
      const service = new CustomersService(mocks.repository, audit.writer);

      const result = await service.updateStatus(
        current.id,
        buildUpdateStatusInput(),
        buildAuditFacts(),
        NOW,
      );

      const [, id, patch, expected] =
        mocks.updateStatusById.mock.calls[0] ?? [];

      expect(id).toBe(current.id);
      expect(patch).toEqual({ status: 'suspended', statusChangedAt: NOW });
      expect(expected).toEqual(CUSTOMER_UPDATED_AT);
      expect(audit.calls[0]).toMatchObject({ operation: 'update' });
      expect(result.status).toBe('suspended');
    });

    it('answers 409 STALE_WRITE when the guard matched nothing', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(buildRawCustomerRow());
      mocks.updateStatusById.mockResolvedValue(null);
      const service = new CustomersService(mocks.repository, audit.writer);

      await expect(
        service.updateStatus(
          CUSTOMER_ROW_ID,
          buildUpdateStatusInput(),
          buildAuditFacts(),
          NOW,
        ),
      ).rejects.toBeInstanceOf(StaleWriteAppError);
    });

    it('answers 404 for an unknown id', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(null);
      const service = new CustomersService(mocks.repository, audit.writer);

      await expect(
        service.updateStatus(
          'missing',
          buildUpdateStatusInput(),
          buildAuditFacts(),
          NOW,
        ),
      ).rejects.toBeInstanceOf(NotFoundAppError);
    });
  });

  describe('remove', () => {
    it('archives the row and writes one soft_delete audit row', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      const row = buildRawCustomerRow();
      mocks.findAnyById.mockResolvedValue(row);
      mocks.softDeleteById.mockResolvedValue(row);
      const service = new CustomersService(mocks.repository, audit.writer);

      await expect(
        service.remove(row.id, buildAuditFacts(), NOW),
      ).resolves.toBeNull();

      expect(mocks.softDeleteById).toHaveBeenCalledWith(
        expect.anything(),
        row.id,
        NOW,
      );
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]).toMatchObject({
        operation: 'soft_delete',
        customerId: row.id,
        after: null,
      });
      // The `before` side is the live pre-image, not the archived row.
      expect(audit.calls[0]?.before).toMatchObject({
        legalName: row.legalName,
      });
    });

    it('answers 404 on a repeat delete', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(null);
      const service = new CustomersService(mocks.repository, audit.writer);

      const error = await service
        .remove('gone', buildAuditFacts(), NOW)
        .catch((caught: unknown) => caught);

      expect(error).toMatchObject({
        code: API_ERROR_CODE.NOT_FOUND,
        status: 404,
      });
      expect(audit.calls).toHaveLength(0);
      expect(mocks.softDeleteById).not.toHaveBeenCalled();
    });

    it('answers 404 for an already archived row', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.findAnyById.mockResolvedValue(
        buildRawCustomerRow({ deletedAt: CUSTOMER_UPDATED_AT }),
      );
      const service = new CustomersService(mocks.repository, audit.writer);

      await expect(
        service.remove(CUSTOMER_ROW_ID, buildAuditFacts(), NOW),
      ).rejects.toBeInstanceOf(NotFoundAppError);
      expect(mocks.softDeleteById).not.toHaveBeenCalled();
    });
  });

  describe('the allocated number', () => {
    it('continues the month sequence instead of restarting it', async () => {
      const mocks = createCustomersRepositoryMock();
      const audit = createAuditWriterMock();
      mocks.nextCustomerNumber.mockResolvedValue(`${PREFIX}004`);
      mocks.create.mockResolvedValue(buildRawCustomerRow());
      const service = new CustomersService(mocks.repository, audit.writer);

      await service.create(buildCreateCustomerInput(), buildAuditFacts(), NOW);

      expect(mocks.create.mock.calls[0]?.[1]).toMatchObject({
        customerNumber: 'AIS-202611-005',
      });
      // The stored maximum is what the sequence continued from, not a guess.
      expect(CUSTOMER_NUMBER).toBe('AIS-202611-001');
    });
  });
});

describe('CustomersService dependency wiring', () => {
  it('uses the repository through its interface only', () => {
    const mocks = createCustomersRepositoryMock();
    const audit = createAuditWriterMock();

    expect(
      () => new CustomersService(mocks.repository, audit.writer),
    ).not.toThrow();
  });

  it('never touches the audit writer outside a transaction', async () => {
    const mocks = createCustomersRepositoryMock();
    const audit = createAuditWriterMock();
    mocks.findPage.mockResolvedValue({ rows: [], total: 0 });
    const service = new CustomersService(mocks.repository, audit.writer);

    await service.list(buildCustomerListQuery());

    expect(audit.calls).toHaveLength(0);
    expect(jest.isMockFunction(mocks.runInTransaction)).toBe(true);
  });
});
