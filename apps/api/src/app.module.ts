import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/config.schema.js';
import { DatabaseModule } from './db/database.module.js';
import { WebhooksModule } from './modules/payments/http/webhooks/webhooks.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { PaymentsHttpModule } from './modules/payments/http/payments.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Throws on a missing or malformed variable, aborting boot.
      validate: validateEnv,
    }),
    DatabaseModule,
    CatalogModule,
    PaymentsHttpModule,
    WebhooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
