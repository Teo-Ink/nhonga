import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
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
}
