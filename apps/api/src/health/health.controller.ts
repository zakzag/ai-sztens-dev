import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe used by Docker and the monitor watchdog.
 *
 * IMPORTANT: this route is intentionally OUTSIDE the global `api` prefix
 * (see `main.ts:setGlobalPrefix(..., { exclude: ['healthz'] })`). It must
 * stay free of any global guards, pipes, or middleware (no auth, no
 * validation, no rate limiting) so that a degraded dependency can never
 * make the healthcheck itself fail.
 */
@Controller('healthz')
export class HealthController {
  @Get()
  check(): { status: 'ok'; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
