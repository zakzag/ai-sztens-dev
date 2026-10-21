/**
 * Types describing the `api-keys` wire contract.
 *
 * These are the *HTTP* shapes, deliberately different from the DB row
 * (`ApiKeyRow` in `db/schema.ts`): timestamps are ISO 8601 strings on the wire
 * and `Date` objects in the row, and `null` is preserved instead of being
 * dropped. Keeping the two types apart is what makes the mapper in
 * `api-keys.mapper.ts` a real, testable transformation instead of a cast.
 */

/** Body of `POST /api/api-keys`; also the payload the DTO validates. */
export interface CreateApiKeyInput {
  /** Human readable label, e.g. `Vapi prod`. */
  readonly name: string;
  /** Unique, URL-safe search key, e.g. `vapi-prod`. */
  readonly identifier: string;
  /** Optional free text; omitted → stored as `null`. */
  readonly description?: string;
  /** The token value itself (masking/rotation is out of scope). */
  readonly apiKey: string;
  /** Optional ISO 8601 timestamp; omitted → stored as `null`. */
  readonly expiresAt?: string;
}

/**
 * A single API key as returned by every endpoint of this module.
 *
 * `expiresAt` / `description` are `null` — never absent — so a client can
 * distinguish “no expiry” from “field not serialised”.
 */
export interface ApiKeyResponse {
  /** Row UUID. */
  readonly id: string;
  /** Human readable label. */
  readonly name: string;
  /** Unique search key. */
  readonly identifier: string;
  /** Optional free text, `null` when the client omitted it. */
  readonly description: string | null;
  /** The stored token value. */
  readonly apiKey: string;
  /** ISO 8601 expiry, `null` when the key never expires. */
  readonly expiresAt: string | null;
  /** ISO 8601 creation timestamp. */
  readonly createdAt: string;
  /** ISO 8601 last-write timestamp. */
  readonly updatedAt: string;
}
