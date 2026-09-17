import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import type { PaymentProvider, ProviderId } from './payment-provider.interface.js';
import { buildProviderRegistry, type PaymentsConfig } from './registry.js';

/**
 * Builds the payment provider registry once at startup and exposes it.
 *
 * The webhook receiver uses only `parseCallback`, but the registry is the one
 * production swap point (registry.ts): the same object serves checkout later.
 */
@Injectable()
export class PaymentProvidersService implements OnModuleInit {
  private registry: ReadonlyMap<ProviderId, PaymentProvider> | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const mode = this.config.get('paymentsMode', { infer: true });

    const paymentsConfig: PaymentsConfig = {
      mode,
      approvalTimeoutSeconds: this.config.get('paymentApprovalTimeoutSeconds', { infer: true }),
      mock: {
        callbackSecret: this.config.get('mockCallbackSecret', { infer: true }),
        minDelayMs: Number(process.env['MOCK_PAYMENT_MIN_DELAY_MS'] ?? 5000),
        maxDelayMs: Number(process.env['MOCK_PAYMENT_MAX_DELAY_MS'] ?? 90000),
        ...(process.env['MOCK_PAYMENT_SEED']
          ? { seed: Number(process.env['MOCK_PAYMENT_SEED']) }
          : {}),
      },
      // Unused in mock mode; buildProviderRegistry only reads these when
      // mode === 'live', where it asserts they are present and, for now, throws
      // because the real adapters await OQ-7/OQ-8.
      mpesa: {
        apiKey: process.env['MPESA_API_KEY'] ?? '',
        publicKey: process.env['MPESA_PUBLIC_KEY'] ?? '',
        serviceProviderCode: process.env['MPESA_SERVICE_PROVIDER_CODE'] ?? '',
        callbackSecret: process.env['MPESA_CALLBACK_SECRET'] ?? '',
      },
      emola: {
        clientId: process.env['EMOLA_CLIENT_ID'] ?? '',
        clientSecret: process.env['EMOLA_CLIENT_SECRET'] ?? '',
        merchantId: process.env['EMOLA_MERCHANT_ID'] ?? '',
        callbackSecret: process.env['EMOLA_CALLBACK_SECRET'] ?? '',
      },
    };

    this.registry = buildProviderRegistry(paymentsConfig, {
      // The mock provider only invokes this from requestPayment (the checkout
      // side), which the webhook receiver never calls. Wiring the mock delivery
      // loop belongs with checkout (Phase 3d); until then it must fail loudly
      // rather than silently swallow a callback.
      deliverMockCallback: () => {
        throw new Error(
          'Mock callback delivery is not wired in the webhook-receiver context. ' +
            'It belongs with the checkout flow (Phase 3d).',
        );
      },
    });
  }

  /** The provider for an id, or undefined if the id is not a registered rail. */
  get(id: ProviderId): PaymentProvider | undefined {
    if (this.registry === null) {
      throw new Error('PaymentProvidersService used before onModuleInit');
    }
    return this.registry.get(id);
  }
}
