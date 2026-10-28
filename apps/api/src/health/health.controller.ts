import { Controller, Get } from '@nestjs/common';
import { SkipEnvelope } from '../common/http/skip-envelope.decorator.js';

/**
 * Liveness probe used by Docker and the monitor watchdog.
 *
 * IMPORTANT: this route is intentionally OUTSIDE the global `api` prefix
 * (see `main.ts:setGlobalPrefix(..., { exclude: ['healthz'] })`). It must
 * stay free of any global guards, pipes, or middleware (no auth, no
 * validation, no rate limiting) so that a degraded dependency can never
 * make the healthcheck itself fail.
 *
 * `@SkipEnvelope()` keeps the body a bare `{status, …}` object: the Docker
 * healthcheck and the monitor watchdog parse exactly that, and the exemption is
 * written down in `ENVELOPE_EXEMPTIONS` (`@callback/shared`). Errors thrown here
 * also stay in Nest's raw shape, so a broken probe cannot start answering with a
 * body its consumers do not understand.
 */
/** Shape of the `/healthz` payload (also asserted by the e2e tests). */
export interface HealthStatus {
  status: 'oks';
  deployDate: string | null;
  commitHash: string | null;
  uptime: number;
  timestamp: string;
}

@SkipEnvelope()
@Controller('healthz')
export class HealthController {
  /**
   * Liveness + build-metadata probe.
   *
   * `deployDate` and `commitHash` are baked into the image at CI build time
   * (see `.github/workflows/images.yml` → `infra/app/Dockerfile`) and read
   * from `process.env` on every call. In local / dev-server runs the
   * variables are unset, so both degrade to `null` and the liveness contract
   * stays unchanged.
   */
  @Get()
  check(): HealthStatus {
    return {
      status: 'oks',
      deployDate: process.env.DEPLOY_DATE ?? null,
      commitHash: process.env.COMMIT_HASH ?? null,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
