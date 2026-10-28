import { createFastifyAdapter } from './create-fastify-adapter.js';

/** Canonical lowercase UUID shape; the version/variant nibbles are not asserted. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Body returned by the probe route registered on the adapter's instance. */
interface ProbeBody {
  readonly id: string;
}

/**
 * Fastify's default `genReqId` is a per-process counter (`req-1`, `req-2`, …),
 * which is not unique across restarts or replicas while it is exactly what ends
 * up in `meta.requestId`. These tests pin the replacement: a UUID per request.
 */
describe('createFastifyAdapter', () => {
  it('generates a UUID request id for every request', async () => {
    const adapter = createFastifyAdapter();
    const instance = adapter.getInstance();

    instance.get('/probe', (request) => ({ id: String(request.id) }));

    try {
      const first = await instance.inject({ method: 'GET', url: '/probe' });
      const second = await instance.inject({ method: 'GET', url: '/probe' });

      const firstId = first.json<ProbeBody>().id;
      const secondId = second.json<ProbeBody>().id;

      expect(firstId).toMatch(UUID_PATTERN);
      expect(secondId).toMatch(UUID_PATTERN);
      expect(firstId).not.toBe(secondId);
      // NOT the Fastify default counter, which would be `req-1` / `req-2`.
      expect(firstId).not.toMatch(/^req-\d+$/);
    } finally {
      await adapter.close();
    }
  });
});
