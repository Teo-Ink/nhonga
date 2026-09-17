import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsQueryService } from './payments-query.service.js';

/**
 * HTTP surface for the already-built payments domain. Currently exposes the
 * read path (GET /payments/:id). The webhook receiver and POST /retry follow
 * once their write paths are wired.
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsQueryService],
})
export class PaymentsHttpModule {}
