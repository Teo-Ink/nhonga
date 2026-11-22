import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { jsonBodyLimits } from './common/body-limits.js';
import { rateLimitMiddleware } from './common/rate-limit.js';
import { postgresCounter, sharedLimitMiddleware } from './common/shared-limit.js';
import { idempotencyMiddleware, postgresIdemStore } from './common/idempotency.js';
import { DB } from './db/database.module.js';
import type { Db } from './db/types.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import { requestContextMiddleware } from './common/request-context.js';
import { JsonLogger } from './common/json-logger.js';
import { initErrorReporting } from './common/error-reporter.js';
import type { AppConfig } from './config/config.schema.js';

async function bootstrap(): Promise<void> {
  const tracking = await initErrorReporting();
  // JSON log lines everywhere except a developer's terminal (P1-08).
  const json = (process.env['NODE_ENV'] ?? 'development') !== 'development';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    ...(json ? { logger: new JsonLogger() } : {}),
    // Preserve the exact request bytes so webhook signature verification can
    // run against them (payments webhook receiver).
    rawBody: true,
  });
  // 100 KB JSON everywhere, 12 MB only on the photo upload routes (SEC-07).
  // Registered first so Nest's default parser skips already-parsed bodies; it
  // keeps rawBody for the payment webhook signatures.
  app.use(requestContextMiddleware());
  app.use(jsonBodyLimits());
  const log = new Logger('Bootstrap');
  const config = app.get(ConfigService<AppConfig, true>);
  const nodeEnv = config.get('nodeEnv', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });

  app.use(helmet());

  // Behind the ALB, req.ip must be the client (from X-Forwarded-For), not the
  // load balancer; one trusted hop.
  if (nodeEnv !== 'development') app.set('trust proxy', 1);
  app.use(rateLimitMiddleware());
  // Abuse-prone writes are counted in Postgres so the limit holds across tasks (P0-04).
  app.use(sharedLimitMiddleware(postgresCounter(app.get<Db>(DB))));
  // Retried payment requests replay the first answer instead of charging twice (P2-11).
  app.use(idempotencyMiddleware(postgresIdemStore(app.get<Db>(DB))));

  // CORS for browser clients only. The web app reaches the API server-side via
  // its BFF and native mobile fetches are not subject to CORS, so this exists
  // mainly for the Expo web preview and any other browser origin we allowlist.
  // In development, any localhost/127.0.0.1 origin (on any port) is reflected so
  // the mobile preview just works; elsewhere only CORS_ORIGINS entries pass.
  const isDev = nodeEnv === 'development';
  const allowList = new Set(corsOrigins);
  const isLocalhost = (origin: string): boolean =>
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
  if (isDev || allowList.size > 0) {
    app.enableCors({
      credentials: true,
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Non-browser / same-origin requests (no Origin header) are always fine.
        if (!origin) return callback(null, true);
        if (allowList.has(origin) || (isDev && isLocalhost(origin))) {
          return callback(null, true);
        }
        return callback(null, false);
      },
    });
  }

  app.useGlobalFilters(new ProblemDetailsFilter());

  // Request-body validation is deliberately not wired globally yet. The stack
  // rationale puts shared Zod schemas in packages/shared for client and server
  // to share; those are not built, and class-validator would be a competing
  // second system. Endpoints that accept a body validate explicitly until then.

  // Let ECS stop a task cleanly: onApplicationShutdown drains the DB pool.
  app.enableShutdownHooks();

  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  log.log(
    `nhonga api listening on :${port} (${nodeEnv}) version=${process.env['APP_VERSION'] ?? 'unknown'} error_tracking=${tracking ? 'on' : 'off'}`,
  );
}

void bootstrap();
