import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB } from '../../../db/database.module.js';
import { payment } from '../../../db/schema/commerce.js';
import type { Db } from '../../../db/types.js';
import { toPaymentResponse, type PaymentResponse } from './payment.mapper.js';

@Injectable()
export class PaymentsQueryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Returns the payment mapped to the contract shape, or null if no such id. */
  async findById(paymentId: string): Promise<PaymentResponse | null> {
    const rows = await this.db
      .select({
        id: payment.id,
        orderId: payment.orderId,
        provider: payment.provider,
        status: payment.status,
        amountCents: payment.amountCents,
        providerRef: payment.providerRef,
        failureCode: payment.failureCode,
        failureMessage: payment.failureMessage,
        expiresAt: payment.expiresAt,
      })
      .from(payment)
      .where(eq(payment.id, paymentId))
      .limit(1);

    const row = rows[0];
    return row ? toPaymentResponse(row) : null;
  }
}
