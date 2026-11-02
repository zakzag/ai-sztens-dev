/**
 * Resource-agnostic MSW handlers.
 *
 * These are **not** part of the default server: they match any URL under the
 * `/api/` prefix, so they would shadow the resource-specific handlers if
 * registered globally. A test opts into one with `server.use(...)`, which
 * prepends it above the default set and makes it win for the request(s) that
 * follow.
 */

import { delay, http, HttpResponse } from 'msw';
import { API_ERROR_CODE } from '@callback/shared';
import { errorResponse, successResponse } from './handler-envelope.js';

/** Any API GET answered with a `500`. */
export const anyUrlServerError = http.get('*/api/*', ({ request }) =>
  errorResponse(API_ERROR_CODE.INTERNAL_ERROR, 'Internal server error', {
    path: request.url,
  }),
);

/** Any API GET answered with a network failure (`status: null`). */
export const anyUrlNetworkError = http.get('*/api/*', () => HttpResponse.error());

/**
 * Any API GET answered after a delay — proves the loading state of a consumer.
 *
 * @param ms - how long to wait before responding; a real timer, kept short.
 */
export function anyUrlDelayed(ms: number) {
  return http.get('*/api/*', async () => {
    await delay(ms);
    return successResponse([]);
  });
}
