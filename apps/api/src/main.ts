import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './common/problem-details.filter.js';
import type { AppConfig } from './config/config.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    // Preserve the exact request bytes so webhook signature verification can
    // run against them (payments webhook receiver).
    rawBody: true,
  });
  const log = new Logger('Bootstrap');

  app.use(helmet());
  app.useGlobalFilters(new ProblemDetailsFilter());

  // Request-body validation is deliberately not wired globally yet. The stack
  // rationale puts shared Zod schemas in packages/shared for client and server
  // to share; those are not built, and class-validator would be a competing
  // second system. Endpoints that accept a body validate explicitly until then.

  // Let ECS stop a task cleanly: onApplicationShutdown drains the DB pool.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });
  await app.listen(port, '0.0.0.0');
  log.log(`nhonga api listening on :${port} (${config.get('nodeEnv', { infer: true })})`);
}

void bootstrap();
