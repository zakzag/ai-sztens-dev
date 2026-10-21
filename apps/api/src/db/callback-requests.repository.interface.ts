import type { CallbackRequestRow, NewCallbackRequestRow } from './schema.js';

/**
 * Persistence contract for `callback.callback_requests`.
 *
 * The contract is intentionally narrow and storage-shaped (it speaks rows, not
 * view models), which keeps two concerns out of this layer:
 *
 * - **Row → API view model mapping** (`createdAt: Date` → ISO string) belongs to
 *   the service layer (AIS-38), so the repository never has to know what the
 *   public JSON looks like.
 * - **HTTP status codes** belong to the service layer too: a missing row is a
 *   {@link CallbackRequestNotFoundError}, which the service translates into
 *   `NotFoundException`. This is why `findOne` throws instead of returning
 *   `null` — the failure is explicit at the call site and impossible to ignore.
 *
 * Consumers depend on this interface, never on the Drizzle implementation, so
 * the persistence layer can be swapped (or mocked in a unit test) without
 * touching a service.
 */
export interface CallbackRequestsRepository {
  /**
   * Insert one row and return what the database actually stored.
   *
   * `id`, `created_at` and `status` may be omitted from `input`: their defaults
   * live in the schema, so the returned row is the authoritative record.
   *
   * @throws {CallbackRequestNotPersistedError} when the insert returns no row.
   * @throws {Error} any database/connection error, unchanged (the caller decides
   * how to surface it).
   */
  create(input: NewCallbackRequestRow): Promise<CallbackRequestRow>;

  /**
   * Every stored request, newest first (`created_at DESC`).
   *
   * The ordering is part of the contract rather than of the SQL a caller happens
   * to write, so paging and listing added later (AIS-38+) start from a stable,
   * deterministic sequence.
   */
  findAll(): Promise<CallbackRequestRow[]>;

  /**
   * One row by primary key.
   *
   * @throws {InvalidCallbackRequestIdError} when `id` is not a canonical dashed
   * UUID — no query is issued in that case.
   * @throws {CallbackRequestNotFoundError} when the id is valid but unknown.
   */
  findOne(id: string): Promise<CallbackRequestRow>;
}
