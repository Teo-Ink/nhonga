import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/config.schema.js';
import { DatabaseModule } from './db/database.module.js';
import { WebhooksModule } from './modules/payments/http/webhooks/webhooks.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { PaymentsHttpModule } from './modules/payments/http/payments.module.js';
import { AssistantModule } from './modules/assistant/assistant.module.js';
import { PromotionsModule } from './modules/promotions/promotions.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { AdsModule } from './modules/ads/ads.module.js';
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
    AuthModule,
    PaymentsHttpModule,
    WebhooksModule,
    AssistantModule,
    PromotionsModule,
    ReviewsModule,
    AdsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
