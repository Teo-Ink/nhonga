import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ADMIN_HEADER, assertAdmin } from '../common/admin.js';
import { SQL, type Sql } from '../db/database.module.js';

/**
 * Two distinct probes, because ECS and the load balancer ask two different
 * questions:
 *   - liveness  "is this process wedged and in need of a restart?"
 *   - readiness "should traffic be routed here right now?"
 * A task with a broken database connection is alive but not ready: restarting
 * it will not fix the database, but it must be pulled from the load balancer.
 */
@Controller('health')
export class HealthController {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ok'; checks: { database: 'ok' } }> {
    try {
      await this.sql`select 1`;
    } catch {
      // Deliberately opaque: a readiness endpoint is often unauthenticated, so
      // it must not leak connection strings or driver internals.
      throw new ServiceUnavailableException({ checks: { database: 'failed' } });
    }
    return { status: 'ok', checks: { database: 'ok' } };
  }

  /**
   * Proves the error tracker end to end: writes one ERROR line with a fresh
   * reference, which the logger forwards to Sentry. Admin token only (404
   * otherwise). The answer says where to look, never whether tracking is on.
   */
  @Post('admin/error-test')
  @HttpCode(202)
  errorTest(@Headers(ADMIN_HEADER) adminToken?: string): { reference: string } {
    assertAdmin(adminToken);
    const reference = `diag-${randomUUID().slice(0, 8)}`;
    new Logger('Diagnostics').error(`Error tracking test ${reference} (not a real failure)`);
    return { reference };
  }
}
