import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/config.schema.js';
import type { PaymentProvider, ProviderId } from './payment-provider.interface.js';
import type { CallbackDelivery } from './providers/mock-wallet.provider.js';
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

  /**
   * Where a mock callback is delivered. Set late (by the checkout/webhook wiring)
   * to route into the webhook ingestion service, which avoids a construction-time
   * DI cycle. Until wired it fails loudly rather than swallowing a callback.
   */
  private deliver: CallbackDelivery = () => {
    throw new Error(
      'Mock callback delivery target is not wired. It is set by MockCallbackWiring once the ' +
        'checkout flow is present (Phase 3d).',
    );
  };

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /** Route mock provider callbacks somewhere (the webhook ingestion service). */
  setCallbackDelivery(deliver: CallbackDelivery): void {
    this.deliver = deliver;
  }

  /** The full provider registry — shared by the webhook receiver and checkout. */
  getRegistry(): ReadonlyMap<ProviderId, PaymentProvider> {
    return this.ensureRegistry();
  }

  onModuleInit(): void {
    this.ensureRegistry();
  }

  /**
   * Build the registry once and cache it. Idempotent so it is safe whether the
   * first caller is onModuleInit or a factory (e.g. checkout) that constructs
   * before lifecycle hooks run.
   */
  private ensureRegistry(): ReadonlyMap<ProviderId, PaymentProvider> {
    if (this.registry !== null) return this.registry;
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
      // Delegates to the late-wired target (set by MockCallbackWiring). The mock
      // provider only invokes this asynchronously, after requestPayment, so the
      // target is always set by the time a callback is delivered.
      deliverMockCallback: (payload) => this.deliver(payload),
    });
    return this.registry;
  }

  /** The provider for an id, or undefined if the id is not a registered rail. */
  get(id: ProviderId): PaymentProvider | undefined {
    return this.ensureRegistry().get(id);
  }
}
