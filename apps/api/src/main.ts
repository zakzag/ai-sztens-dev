import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { APP_ENV, APP_ENV_RAW, isProd } from './config/app-env.js';

async function bootstrap() {
  // `rawBody: true` makes the Fastify adapter expose the byte-exact request
  // body as `request.rawBody`. The VAPI webhook receiver needs this because
  // the HMAC-SHA256 over the payload is computed against the raw bytes the
  // VAPI server sent — the JSON parser would otherwise re-serialise the
  // body (key order, unicode escapes, whitespace) and break the signature.
  // See `apps/api/src/vapi-webhooks/vapi-signature.guard.ts` for the
  // consumer of `rawBody`.
  //
  // IMPORTANT: `rawBody` is a **Nest application** option (3rd argument of
  // `NestFactory.create`), NOT a Fastify adapter option. `NestApplication`
  // reads it and passes it to the adapter's `registerParserMiddleware()`
  // (`@nestjs/core/nest-application.js`), which is what makes the adapter
  // register the JSON parser with raw-body capture. Passing it to
  // `new FastifyAdapter({ rawBody: true })` compiles to nothing but a
  // TypeScript error (the option does not exist there) and silently leaves
  // `request.rawBody` undefined — every webhook would then fail with 401.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { rawBody: true },
  );

  // All HTTP endpoints live under /api (e.g. POST /api/callback-requests).
  // `healthz` is excluded so the Docker healthcheck and the monitor watchdog
  // can hit a stable, unprefixed path that never drifts with the business
  // routing. Keep this list in sync with the controllers that must stay
  // outside the prefix (currently only HealthController).
  app.setGlobalPrefix('api', { exclude: ['healthz'] });

  // CORS is driven by @fastify/cors (ships with @nestjs/platform-fastify).
  // The allow-list comes from the per-env file picked at boot by
  // `ConfigModule` (apps/api/.env.<APP_ENV>). An empty list is only ever
  // produced in dev (where the developer intentionally wants an open API);
  // prod MUST have an explicit allow-list — log a loud warning if not.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (isProd && allowedOrigins.length === 0) {
    Logger.error(
      'CORS_ORIGINS is empty in prod. Refusing to start with an open CORS policy.',
      'Bootstrap',
    );
    process.exit(1);
  }
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Bind explicitly to 0.0.0.0 so the Fastify listener is reachable from
  // OTHER containers (e.g. the Caddy reverse proxy on the `internal`
  // Docker network). Without the explicit host, Fastify's `listen(port)`
  // falls back to a loopback-only bind (`127.0.0.1` / `[::1]`), the
  // container's healthcheck still passes (it hits 127.0.0.1 inside the
  // container), but Caddy's `reverse_proxy api:3000` from a sibling
  // container gets `connection refused` and the public API returns 502.
  // Verified via /proc/net/tcp inside the api container: 127.0.0.1:3000
  // and [::1]:3000 were the only listeners before this fix.
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');

  // Loud boot banner so an env mismatch is immediately visible in the
  // container log (and the deploy's tail). Cheap, and saves debugging.
  Logger.log(
    `API up — APP_ENV=${APP_ENV} (raw=${APP_ENV_RAW}), listening on 0.0.0.0:${process.env.PORT ?? 3000}, CORS origins: ${allowedOrigins.length === 0 ? '<open>' : allowedOrigins.join(',')}`,
    'Bootstrap',
  );
}
void bootstrap();
