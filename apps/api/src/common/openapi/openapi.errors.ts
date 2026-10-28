/**
 * Errors of the OpenAPI layer (AIS-98).
 *
 * They are *build-time* failures, not HTTP failures: the document is generated
 * from the shared registry at import time, so a registry entry that cannot be
 * documented must stop the process (or the test run) instead of producing a
 * silently incomplete spec.
 */

/** A registry entry uses a payload schema that has no component name. */
export class UnregisteredPayloadSchemaError extends Error {
  /**
   * @param operationId - the registry entry whose `dataSchema` is unnamed.
   */
  constructor(operationId: string) {
    super(
      `The payload schema of "${operationId}" has no OpenAPI component name. Register it in PAYLOAD_COMPONENTS (apps/api/src/common/openapi/zod-openapi.ts).`,
    );
    this.name = 'UnregisteredPayloadSchemaError';
  }
}
