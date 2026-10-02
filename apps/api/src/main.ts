import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // All HTTP endpoints live under /api (e.g. POST /api/callback-requests).
  // `healthz` is excluded so the Docker healthcheck and the monitor watchdog
  // can hit a stable, unprefixed path that never drifts with the business
  // routing. Keep this list in sync with the controllers that must stay
  // outside the prefix (currently only HealthController).
  app.setGlobalPrefix('api', { exclude: ['healthz'] });

  // CORS is driven by @fastify/cors (ships with @nestjs/platform-fastify).
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
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
}
void bootstrap();
