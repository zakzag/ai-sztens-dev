/**
 * `fetch` doubles for the api-client tests.
 *
 * Every test injects one of these through `HttpClientConfig.fetchImpl`, so no
 * request ever leaves the process. The doubles live here (not inside the spec
 * files) because the service tests and the transport tests share them.
 */

/** One recorded invocation of the doubled `fetch`. */
export interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

/** Injection-ready double plus the calls it recorded. */
export interface FetchMock {
  readonly fetchImpl: typeof fetch;
  readonly calls: RecordedCall[];
}

/** Reads the URL out of whatever `fetch` was called with. */
function toUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.toString() : input.url;
}

/**
 * Builds a JSON `Response` the way Fastify does.
 *
 * @param body - payload serialised as JSON.
 * @param status - HTTP status (default 200).
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: STATUS_TEXT[status] ?? 'Unknown',
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Body that is not valid JSON (e.g. an HTML proxy error page). */
export function textResponse(body: string, status = 500): Response {
  return new Response(body, {
    status,
    statusText: STATUS_TEXT[status] ?? 'Unknown',
    headers: { 'Content-Type': 'text/plain' },
  });
}

/** Response with no body at all. */
export function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

/** Minimal status-text table, so failures read like a real server. */
const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

/**
 * Creates a `fetch` double driven by a responder callback.
 *
 * @param responder - returns (or resolves to) the response for one call.
 */
export function createFetchMock(
  responder: (call: RecordedCall) => Response | Promise<Response>,
): FetchMock {
  const calls: RecordedCall[] = [];

  const fetchImpl = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const call: RecordedCall = { url: toUrl(input), init };
    calls.push(call);
    return responder(call);
  };

  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

/**
 * Creates a `fetch` double that answers with the supplied responses in order.
 *
 * The last response is reused when more calls happen than responses were given,
 * which keeps a retry inside a test from throwing “no response left”.
 *
 * @param responses - responses to return, in call order.
 */
export function createSequenceFetchMock(
  responses: readonly Response[],
): FetchMock {
  let index = 0;

  return createFetchMock(() => {
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;

    if (response === undefined) {
      throw new Error('createSequenceFetchMock: no response was supplied');
    }

    return response;
  });
}

/**
 * Creates a `fetch` double that rejects, simulating a dead network.
 *
 * @param error - the rejection reason (default: a `TypeError` like the real one).
 */
export function createRejectingFetchMock(
  error: unknown = new TypeError('fetch failed'),
): FetchMock {
  return createFetchMock(() => {
    throw error;
  });
}
