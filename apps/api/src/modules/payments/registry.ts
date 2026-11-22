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
  }
  // Live: no direct wallet adapters. Money now enters through the hosted
  // checkout (PawaPay primary, PaySuite backup — modules/checkout) into the
  // seller's wallet, and paid features are charged from the wallet. The old
  // direct Vodacom/Movitel push adapters (OQ-7, OQ-8) are not needed for that,
  // so live mode registers none: the direct-pay endpoints (promotions,
  // subscriptions, ads) then refuse instead of granting anything for free.

  // COD has no external dependency and is therefore identical in every environment.
  providers.set('cod', new CodProvider());

  return providers;
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
