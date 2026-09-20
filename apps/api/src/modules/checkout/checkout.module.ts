import { Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import { DB } from '../../db/database.module.js';
import type { Db } from '../../db/types.js';
import { PaymentEventProcessor } from '../payments/payment-event.processor.js';
import { PaymentProvidersService } from '../payments/providers.service.js';
import { ReconciliationWorker } from '../payments/reconciliation.worker.js';
import { WebhooksModule } from '../payments/http/webhooks/webhooks.module.js';
import { CheckoutService } from './checkout.service.js';
import {
  loadFieldKey,
  makeFieldEncryptor,
  makeOrderNumberGenerator,
  offlineDeliveryQuoter,
} from './checkout-deps.js';
import { CheckoutController } from './checkout.controller.js';
import { CHECKOUT_SERVICE, GuestCheckoutService } from './guest-checkout.service.js';
import { OrderQueryService } from './order-query.service.js';

const LATE_SWEEP_HOURS = 24;

/**
 * Constructs the (framework-free) CheckoutService with concrete dependencies:
 * the shared payment registry, a zero-fee delivery quoter, an order-number
 * generator, real AES-GCM field encryption, and a reconciliation backup that
 * polls the provider after the approval window in case the callback never lands.
 */
const checkoutServiceProvider: Provider = {
  provide: CHECKOUT_SERVICE,
  inject: [DB, ConfigService, PaymentProvidersService],
  useFactory: (
    db: Db,
    config: ConfigService<AppConfig, true>,
    providers: PaymentProvidersService,
  ): CheckoutService => {
    const log = new Logger('Checkout');
    const registry = providers.getRegistry();
    const now = (): Date => new Date();
    const approvalTimeoutSeconds = config.get('paymentApprovalTimeoutSeconds', { infer: true });

    const worker = new ReconciliationWorker({
      db,
      providers: registry,
      processor: new PaymentEventProcessor({ db, now }),
      now,
      alert: (message, context) => log.warn(`${message} ${JSON.stringify(context)}`),
    });

    return new CheckoutService({
      db,
      shipping: offlineDeliveryQuoter,
      orderNumbers: makeOrderNumberGenerator(),
      providers: registry,
      approvalTimeoutSeconds,
      lateSweepHours: LATE_SWEEP_HOURS,
      encryptField: makeFieldEncryptor(loadFieldKey(process.env['FIELD_ENCRYPTION_KEY'])),
      scheduleReconciliation: async (_paymentId: string): Promise<void> => {
        // Backup path: the mock callback normally settles the payment via the
        // webhook. If it never arrives, poll the provider shortly after the
        // approval window closes. unref so it never holds the process open.
        const timer = setTimeout(
          () => {
            void worker.pollPending().catch((err: unknown) => {
              log.error('reconciliation sweep failed', err as Error);
            });
          },
          (approvalTimeoutSeconds + 5) * 1000,
        );
        if (typeof timer.unref === 'function') timer.unref();
      },
    });
  },
};

@Module({
  imports: [WebhooksModule],
  controllers: [CheckoutController],
  providers: [checkoutServiceProvider, GuestCheckoutService, OrderQueryService],
})
export class CheckoutModule {}
