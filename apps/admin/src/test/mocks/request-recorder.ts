/**
 * Captures the requests MSW intercepted, for tests that must assert on the
 * *payload the client sent* rather than on a mock call (there is no service
 * double anymore — the request body is the only place that fact lives).
 */

import { server } from './server.js';

/** One captured request. */
export interface RecordedRequest {
  /** HTTP method, e.g. `POST`. */
  readonly method: string;
  /** Absolute URL the transport called. */
  readonly url: string;
  /** Parsed JSON body, or `null` when the request carried no JSON body. */
  readonly body: unknown;
}

/** Handle returned by {@link createRequestRecorder}. */
export interface RequestRecorder {
  /** Requests captured so far, in interception order. */
  readonly requests: readonly RecordedRequest[];
  /** Detaches the recorder from the server; call it at the end of the test. */
  readonly stop: () => void;
}

/**
 * Records every intercepted request until {@link RequestRecorder.stop} runs.
 *
 * @returns the recorder handle.
 */
export function createRequestRecorder(): RequestRecorder {
  const requests: RecordedRequest[] = [];

  const listener = ({ request }: { readonly request: Request }): void => {
    const method = request.method;
    const url = request.url;

    request
      .clone()
      .json()
      .then(
        (body: unknown) => {
          requests.push({ method, url, body });
        },
        () => {
          requests.push({ method, url, body: null });
        },
      );
  };

  server.events.on('request:start', listener);

  return {
    requests,
    stop: () => {
      server.events.removeListener('request:start', listener);
    },
  };
}
