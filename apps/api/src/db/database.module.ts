import { Global, Inject, Module, type OnApplicationShutdown, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import type { Db } from './types.js';
import type { AppConfig } from '../config/config.schema.js';

/** DI token for the Drizzle handle. Services inject this, never the raw client. */
export const DB = Symbol('DB');
/** DI token for the underlying postgres.js client, needed for health pings and shutdown. */
export const SQL = Symbol('SQL');

export type Sql = ReturnType<typeof postgres>;

const sqlProvider: Provider = {
  provide: SQL,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): Sql => {
    const url = config.get('databaseUrl', { infer: true });
    // Conservative pool. ECS runs multiple tasks and Postgres connection count
    // is a shared budget (see 06-infrastructure.md), so each task stays modest.
    return postgres(url, {
      max: Number(process.env['DB_POOL_MAX'] ?? 10),
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: true,
    });
  },
};

const dbProvider: Provider = {
  provide: DB,
  inject: [SQL],
  useFactory: (sql: Sql): Db => drizzle(sql, { schema }),
};

@Global()
@Module({
  providers: [sqlProvider, dbProvider],
  exports: [DB, SQL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  async onApplicationShutdown(): Promise<void> {
    // Drain the pool on shutdown so in-flight queries finish and ECS can
    // replace the task without dropping a transaction mid-flight.
    await this.sql.end({ timeout: 5 });
  }
}
