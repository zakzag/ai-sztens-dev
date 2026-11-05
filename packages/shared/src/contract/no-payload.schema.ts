/**
 * The payload of a call that has nothing to return (AIS-108, plan `D7`).
 *
 * `API_CONVENTION` §4 fixes the answer of such a call to `200` + `data: null`,
 * never `204`: a `204` has no body at all, so it cannot carry `meta.requestId`,
 * and the client would have to special-case one status instead of reading the
 * envelope it always reads. `null` is therefore a *value*, not a missing one —
 * and because `envelopeOf()` can only describe a payload that has a component
 * name, the value needs this named schema.
 *
 * Why `z.null()` and not `z.undefined()` / `z.void()`: an absent `data` key and
 * a `null` `data` key are different wire states, and only the latter is a
 * success answer this contract allows. `JSON.stringify` drops `undefined`
 * anyway, so a schema that accepted it would describe a body the server can
 * never actually send.
 */

import { z } from 'zod';

/**
 * Payload of an enveloped call with no return value.
 *
 * Registered in the OpenAPI document as the component `NoPayload`; the same
 * schema is what the client parses, so a `204` or a body with data would fail
 * loudly at the edge instead of quietly.
 */
export const noPayloadSchema = z.null();
