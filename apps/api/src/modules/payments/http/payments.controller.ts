import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { PaymentsQueryService } from './payments-query.service.js';
import type { PaymentResponse } from './payment.mapper.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsQueryService) {}

  /**
   * Poll payment status — the client's safety net when the webhook is slow.
   * The client renders exactly this; it never decides payment state itself.
   */
  @Get(':paymentId')
  async getById(
    // ParseUUIDPipe rejects a malformed id with 400 before any query runs.
    @Param('paymentId', new ParseUUIDPipe({ version: '4' })) paymentId: string,
  ): Promise<PaymentResponse> {
    const found = await this.payments.findById(paymentId);
    if (!found) {
      throw new NotFoundException({ error: 'Not Found', message: `No payment ${paymentId}` });
    }
    return found;
  }
}
