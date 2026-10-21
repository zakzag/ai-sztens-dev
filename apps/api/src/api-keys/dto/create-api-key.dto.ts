/**
 * class-validator DTO for `POST /api/api-keys`.
 *
 * Validation happens at the edge (the global `ValidationPipe` in `main.ts`,
 * configured with `whitelist` + `forbidNonWhitelisted` + `transform`), so the
 * service receives an already-typed object and never re-checks lengths. The
 * limits come from `api-keys.const.ts`, the same symbols the tests assert on.
 *
 * `forbidNonWhitelisted` is what makes `id` / `createdAt` / `updatedAt`
 * impossible to inject from the client: they are not declared here, so the
 * request is rejected with 400 instead of silently ignored.
 *
 * The property declarations use definite-assignment assertions (`!`) on
 * purpose: a DTO is populated by class-transformer from untrusted input, so
 * every field is "unset until validated" and there is no meaningful default to
 * initialise.
 */

import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  API_KEY_DESCRIPTION_MAX_LENGTH,
  API_KEY_IDENTIFIER_PATTERN,
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_VALUE_MAX_LENGTH,
} from '../api-keys.const.js';
import type { CreateApiKeyInput } from '../api-keys.interface.js';

export class CreateApiKeyDto implements CreateApiKeyInput {
  /** Human readable label. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(API_KEY_NAME_MAX_LENGTH)
  name!: string;

  /** Unique, URL-safe search key. */
  @IsString()
  @Matches(API_KEY_IDENTIFIER_PATTERN, {
    message:
      'identifier must be 1-200 characters of letters, digits, dot, dash or underscore',
  })
  identifier!: string;

  /** Optional free text. */
  @IsOptional()
  @IsString()
  @MaxLength(API_KEY_DESCRIPTION_MAX_LENGTH)
  description?: string;

  /** The token value itself. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(API_KEY_VALUE_MAX_LENGTH)
  apiKey!: string;

  /** Optional ISO 8601 expiry; stored as `timestamptz`. */
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
