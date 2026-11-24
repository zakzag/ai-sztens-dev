import type { NewAuditLogRow } from '../db/schema.js';
import { AuditPayloadIncompleteError } from './audit.errors.js';
import { AuditWriterService } from './audit-writer.service.js';
import {
  AUDIT_CUSTOMER_ID,
  AUDIT_RECORD_ID,
  buildAuditActor,
  buildAuditRequestFacts,
  buildAuditWriteInput,
  createAuditActorProviderMock,
  createAuditRepositoryMock,
  createTransactionMock,
} from './test/mocks/audit.mock.js';
import type {
  AuditActorProviderMock,
  AuditRepositoryMock,
} from './test/mocks/audit.mock.js';

/**
 * Unit tests for the single audit entry point (AIS-177).
 *
 * What is pinned here is the *contract with the caller*, not Drizzle's SQL: one
 * row per real change, never a row for a no-op, the actor from the provider, the
 * request facts untouched, and the caller's transaction handle — never its own.
 */
describe('AuditWriterService', () => {
  interface Harness {
    readonly writer: AuditWriterService;
    readonly repository: AuditRepositoryMock;
    readonly actorProvider: AuditActorProviderMock;
  }

  function build(): Harness {
    const repository = createAuditRepositoryMock();
    const actorProvider = createAuditActorProviderMock();

    return {
      writer: new AuditWriterService(repository, actorProvider),
      repository,
      actorProvider,
    };
  }

  /** @returns the only recorded row, failing the test when there is none. */
  function onlyRow(repository: AuditRepositoryMock): NewAuditLogRow {
    const [row] = repository.calls;

    if (row === undefined) {
      throw new Error('expected the repository to receive exactly one row');
    }

    return row;
  }

  describe('successful writes', () => {
    it('writes one row for an insert, with no before side', async () => {
      const { writer, repository } = build();
      const facts = buildAuditRequestFacts();
      const tx = createTransactionMock();

      await writer.write(
        buildAuditWriteInput({
          operation: 'insert',
          before: null,
          after: { legal_name: 'Új Kft.', status: 'prospect' },
        }),
        tx,
        facts,
      );

      expect(repository.calls).toHaveLength(1);
      expect(onlyRow(repository)).toEqual({
        customerId: AUDIT_CUSTOMER_ID,
        tableName: 'customers',
        recordId: AUDIT_RECORD_ID,
        operation: 'insert',
        beforeData: null,
        afterData: { legal_name: 'Új Kft.', status: 'prospect' },
        actorType: 'system',
        actorId: null,
        actorName: 'system',
        ipAddress: facts.ipAddress,
        userAgent: facts.userAgent,
        requestId: facts.requestId,
        source: facts.source,
      });
      expect(repository.transactions[0]).toBe(tx);
    });

    it('stores only the changed keys of an update', async () => {
      const { writer, repository } = build();

      await writer.write(
        buildAuditWriteInput(),
        createTransactionMock(),
        buildAuditRequestFacts(),
      );

      const row = onlyRow(repository);

      expect(row.beforeData).toEqual({ legal_name: 'Régi Név Kft.' });
      expect(row.afterData).toEqual({ legal_name: 'Új Név Kft.' });
      expect(row.operation).toBe('update');
    });

    it('records a soft delete as a change without an after side', async () => {
      const { writer, repository } = build();

      await writer.write(
        buildAuditWriteInput({ operation: 'soft_delete', after: null }),
        createTransactionMock(),
        buildAuditRequestFacts(),
      );

      const row = onlyRow(repository);

      expect(row.operation).toBe('soft_delete');
      expect(row.afterData).toBeNull();
      expect(row.beforeData).toEqual({
        id: AUDIT_RECORD_ID,
        legal_name: 'Régi Név Kft.',
        tax_number: '12345678-1-42',
      });
    });

    it('takes the actor from the provider, so the auth story changes one file', async () => {
      const actor = buildAuditActor({
        type: 'operator',
        id: AUDIT_CUSTOMER_ID,
        name: 'Kálmán',
      });
      const repository = createAuditRepositoryMock();
      const actorProvider = createAuditActorProviderMock(actor);
      const writer = new AuditWriterService(repository, actorProvider);

      await writer.write(
        buildAuditWriteInput(),
        createTransactionMock(),
        buildAuditRequestFacts(),
      );

      const row = onlyRow(repository);

      expect(actorProvider.callCount()).toBe(1);
      expect(row.actorType).toBe('operator');
      expect(row.actorId).toBe(AUDIT_CUSTOMER_ID);
      expect(row.actorName).toBe('Kálmán');
    });

    it('passes the caller transaction handle through unchanged', async () => {
      const { writer, repository } = build();
      const tx = createTransactionMock();

      await writer.write(buildAuditWriteInput(), tx, buildAuditRequestFacts());

      expect(repository.transactions[0]).toBe(tx);
    });
  });

  describe('no-ops', () => {
    it('writes nothing when an update changed no field', async () => {
      const { writer, repository, actorProvider } = build();
      const row = { legal_name: 'Ugyanaz Kft.' };

      await writer.write(
        buildAuditWriteInput({ before: row, after: { ...row } }),
        createTransactionMock(),
        buildAuditRequestFacts(),
      );

      expect(repository.calls).toHaveLength(0);
      // A no-op is not worth asking who did it.
      expect(actorProvider.callCount()).toBe(0);
    });
  });

  describe('incoherent payloads', () => {
    it('rejects an insert without an after side', async () => {
      const { writer, repository } = build();

      await expect(
        writer.write(
          buildAuditWriteInput({
            operation: 'insert',
            before: null,
            after: null,
          }),
          createTransactionMock(),
          buildAuditRequestFacts(),
        ),
      ).rejects.toBeInstanceOf(AuditPayloadIncompleteError);

      expect(repository.calls).toHaveLength(0);
    });

    it('rejects a delete without a before side', async () => {
      const { writer, repository } = build();

      await expect(
        writer.write(
          buildAuditWriteInput({
            operation: 'delete',
            before: null,
            after: null,
          }),
          createTransactionMock(),
          buildAuditRequestFacts(),
        ),
      ).rejects.toBeInstanceOf(AuditPayloadIncompleteError);

      expect(repository.calls).toHaveLength(0);
    });

    it('rejects an update that is missing one of its sides', async () => {
      const { writer, repository } = build();

      await expect(
        writer.write(
          buildAuditWriteInput({ operation: 'update', after: null }),
          createTransactionMock(),
          buildAuditRequestFacts(),
        ),
      ).rejects.toBeInstanceOf(AuditPayloadIncompleteError);

      expect(repository.calls).toHaveLength(0);
    });
  });

  describe('failure propagation', () => {
    it('lets a rejected insert escape, so the business write rolls back', async () => {
      const repository = createAuditRepositoryMock();
      const failure = new Error('insert into audit.audit_logs failed');
      repository.failNextWith(failure);
      const writer = new AuditWriterService(
        repository,
        createAuditActorProviderMock(),
      );

      await expect(
        writer.write(
          buildAuditWriteInput(),
          createTransactionMock(),
          buildAuditRequestFacts(),
        ),
      ).rejects.toBe(failure);
    });
  });
});
