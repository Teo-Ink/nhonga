/**
 * Provider registry.
 *
 * **This file is the entire production swap.** When the Vodacom and Movitel merchant agreements
 * land (OQ-7, OQ-8), real credentials go into Secrets Manager, `PAYMENTS_MODE` becomes `live`,
 * and the two `MockWalletProvider` instances below become `MpesaProvider` and `EmolaProvider`.
 *
 * Nothing else changes — not the checkout endpoint, not the order module, not the state
 * machines, not the web or mobile clients. If any of those need changing when real credentials
 * arrive, the abstraction was wrong, and that is a bug to fix before going live rather than
 * something to work around.
 *
 * See docs/phase-2-architecture/04-payments-architecture.md §7.
 */

import { CodProvider } from './providers/cod.provider.js';
import {
  MockWalletProvider,
  type CallbackDelivery,
  type Scheduler,
} from './providers/mock-wallet.provider.js';
import type { PaymentProvider, ProviderId } from './payment-provider.interface.js';

export type PaymentsMode = 'mock' | 'live';

export interface PaymentsConfig {
  readonly mode: PaymentsMode;
  readonly approvalTimeoutSeconds: number;
  readonly mock: {
    readonly minDelayMs: number;
    readonly maxDelayMs: number;
    readonly callbackSecret: string;
    readonly seed?: number;
  };
  readonly mpesa: {
    readonly apiKey: string;
    readonly publicKey: string;
    readonly serviceProviderCode: string;
    readonly callbackSecret: string;
  };
  readonly emola: {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly merchantId: string;
    readonly callbackSecret: string;
  };
}

export class PaymentsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentsConfigError';
  }
}

export interface RegistryDependencies {
  /** Delivers a mock callback into our own webhook route. Unused in live mode. */
  readonly deliverMockCallback: CallbackDelivery;
  readonly schedule?: Scheduler;
}

/**
 * Build the provider map for the current environment.
 *
 * Fails loudly rather than silently falling back to mocks when `live` is configured without
 * credentials. A production deploy that quietly runs mock payments would accept orders and
 * never charge anyone — the failure mode is silent, total, and discovered by an accountant.
 */
export function buildProviderRegistry(
  config: PaymentsConfig,
  deps: RegistryDependencies,
): ReadonlyMap<ProviderId, PaymentProvider> {
  const providers = new Map<ProviderId, PaymentProvider>();

  if (config.mode === 'mock') {
    providers.set(
      'mpesa',
      new MockWalletProvider(
        {
          providerId: 'mpesa',
          callbackSecret: config.mock.callbackSecret,
          minDelayMs: config.mock.minDelayMs,
          maxDelayMs: config.mock.maxDelayMs,
          approvalTimeoutSeconds: config.approvalTimeoutSeconds,
          ...(config.mock.seed === undefined ? {} : { seed: config.mock.seed }),
        },
        deps.deliverMockCallback,
        deps.schedule,
      ),
    );

    providers.set(
      'emola',
      new MockWalletProvider(
        {
          providerId: 'emola',
          callbackSecret: config.mock.callbackSecret,
          minDelayMs: config.mock.minDelayMs,
          maxDelayMs: config.mock.maxDelayMs,
          approvalTimeoutSeconds: config.approvalTimeoutSeconds,
          ...(config.mock.seed === undefined ? {} : { seed: config.mock.seed }),
        },
        deps.deliverMockCallback,
        deps.schedule,
      ),
    );
  } else {
    assertCredentials('M-Pesa', {
      apiKey: config.mpesa.apiKey,
      publicKey: config.mpesa.publicKey,
      serviceProviderCode: config.mpesa.serviceProviderCode,
      callbackSecret: config.mpesa.callbackSecret,
    });
    assertCredentials('e-Mola', {
      clientId: config.emola.clientId,
      clientSecret: config.emola.clientSecret,
      merchantId: config.emola.merchantId,
      callbackSecret: config.emola.callbackSecret,
    });

    // ── THE SWAP ────────────────────────────────────────────────────────────
    // providers.set('mpesa', new MpesaProvider(config.mpesa));
    // providers.set('emola', new EmolaProvider(config.emola));
    //
    // Blocked on OQ-7 and OQ-8. The adapter classes cannot be written correctly until the
    // integration specifications arrive with the signed merchant agreements — endpoint paths,
    // exact field names, and the signature algorithm are not public. Deliberately left
    // unimplemented rather than guessed at, so `PAYMENTS_MODE=live` fails at startup instead
    // of failing at a buyer's checkout.
    throw new PaymentsConfigError(
      'Live payment providers are not implemented yet. The M-Pesa and e-Mola adapters require ' +
        'the integration specifications issued with the Vodacom and Movitel merchant agreements ' +
        '(OQ-7, OQ-8). Set PAYMENTS_MODE=mock until those are in place.',
    );
  }

  // COD has no external dependency and is therefore identical in every environment.
  providers.set('cod', new CodProvider());

  return providers;
}

function assertCredentials(label: string, values: Readonly<Record<string, string>>): void {
  const missing = Object.entries(values)
    .filter(([, value]) => value === undefined || value === null || value.trim() === '')
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new PaymentsConfigError(
      `PAYMENTS_MODE is "live" but ${label} credentials are missing: ${missing.join(', ')}. ` +
        'These come from AWS Secrets Manager and must never be hardcoded.',
    );
  }
}

/** Look up a provider, failing clearly rather than returning undefined into a payment path. */
export function requireProvider(
  registry: ReadonlyMap<ProviderId, PaymentProvider>,
  id: ProviderId,
): PaymentProvider {
  const provider = registry.get(id);
  if (provider === undefined) {
    throw new PaymentsConfigError(`No payment provider is registered for "${id}"`);
  }
  return provider;
}
