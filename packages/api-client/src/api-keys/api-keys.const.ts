/**
 * Constants of the `api-keys` service.
 *
 * The path is **derived** from the endpoint registry (`AIS-89`): the route is
 * written down once in `@callback/shared`, and `clientPathOf()` converts it to
 * the shape the transport expects. The base URL already contains the global
 * `/api` prefix, so the effective request is `/api/api-keys`.
 */

import { clientPathOf } from '../endpoint-path.js';

/** Path of the collection endpoint, relative to the injected base URL. */
export const API_KEYS_PATH = clientPathOf('apiKeys.list');
