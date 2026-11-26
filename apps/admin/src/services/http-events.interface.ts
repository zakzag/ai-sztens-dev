import type { HttpEvent } from '@callback/api-client';

/**
 * Receives every finished HTTP attempt of the shared transport.
 *
 * A listener is a **consumer**, never a participant: it cannot change a response
 * and cannot fail a request (the transport wraps the call), so a broken sink can
 * never break the admin.
 *
 * Declared in `services` — not in `app` — because the composition root wires it
 * into the client, and `services` must not import `app` (layer rule
 * `no-service-to-higher-layer`). The app registers the real listener at boot.
 */
export type HttpEventListener = (event: HttpEvent) => void;
