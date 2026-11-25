/**
 * Builds the gateway set from the environment. Secrets come only from env;
 * nothing is hardcoded. In live mode a missing credential is a startup error,
 * not a runtime surprise at the first payment.
 *
 *   CHECKOUT_MODE            mock | live   (default: live in production, else mock)
 *   CHECKOUT_PRIMARY         pawapay | paysuite   (default pawapay)
 *   CHECKOUT_BACKUP          pawapay | paysuite | none   (default paysuite)
 *   PAWAPAY_API_TOKEN        Bearer token from the PawaPay dashboard
 *   PAWAPAY_BASE_URL         default https://api.sandbox.pawapay.io
 *   PAWAPAY_CALLBACK_URL     default {PUBLIC_API_URL}/v1/checkout/webhooks/pawapay;
 *                            must be the URL registered in the PawaPay dashboard
 *   PAWAPAY_REQUIRE_SIGNED_CALLBACKS  "true" rejects callbacks without a signature
 *   PAYSUITE_API_TOKEN       Bearer token from the PaySuite dashboard
 *   PAYSUITE_WEBHOOK_SECRET  Webhook signing secret from the PaySuite dashboard
 *   PAYSUITE_BASE_URL        default https://paysuite.tech
 *   PUBLIC_API_URL           where gateways post webhooks (must be public in live)
 *   PUBLIC_WEB_URL           where buyers return after paying
 */

import type { CheckoutGateway, FetchLike, GatewayId } from './checkout.types.js';
import { MockGateway } from './gateways/mock.gateway.js';
import { PawaPayGateway } from './gateways/pawapay.gateway.js';
import { PaySuiteGateway } from './gateways/paysuite.gateway.js';

export interface CheckoutSetup {
  readonly mode: 'mock' | 'live';
  /** Gateways in preference order: primary first, then backup. */
  readonly chain: readonly CheckoutGateway[];
  /** Every configured gateway by id (for webhooks and status of older intents). */
  readonly byId: ReadonlyMap<GatewayId, CheckoutGateway>;
  readonly mock: MockGateway | null;
  readonly publicApiUrl: string;
  readonly publicWebUrl: string;
}

type Env = Readonly<Record<string, string | undefined>>;

export function buildCheckoutSetup(env: Env, fetchImpl: FetchLike): CheckoutSetup {
  const publicApiUrl = trimSlash(env['PUBLIC_API_URL'] ?? 'http://localhost:3000');
  const publicWebUrl = trimSlash(env['PUBLIC_WEB_URL'] ?? 'http://localhost:3001');
  const mode = (
    env['CHECKOUT_MODE'] ?? (env['NODE_ENV'] === 'production' ? 'live' : 'mock')
  ).toLowerCase();

  if (mode === 'mock') {
    const mock = new MockGateway(publicWebUrl);
    return {
      mode: 'mock',
      chain: [mock],
      byId: new Map([['mock', mock]]),
      mock,
      publicApiUrl,
      publicWebUrl,
    };
  }
  if (mode !== 'live') throw new Error(`CHECKOUT_MODE must be "mock" or "live", got "${mode}"`);

  const build = (id: string): CheckoutGateway => {
    if (id === 'pawapay') {
      return new PawaPayGateway(
        {
          apiToken: required(env, 'PAWAPAY_API_TOKEN'),
          baseUrl: trimSlash(env['PAWAPAY_BASE_URL'] ?? 'https://api.sandbox.pawapay.io'),
          callbackUrl:
            env['PAWAPAY_CALLBACK_URL'] ?? `${publicApiUrl}/v1/checkout/webhooks/pawapay`,
          requireSignedCallbacks: flag(env['PAWAPAY_REQUIRE_SIGNED_CALLBACKS']),
        },
        fetchImpl,
      );
    }
    if (id === 'paysuite') {
      return new PaySuiteGateway(
        {
          apiToken: required(env, 'PAYSUITE_API_TOKEN'),
          webhookSecret: required(env, 'PAYSUITE_WEBHOOK_SECRET'),
          baseUrl: trimSlash(env['PAYSUITE_BASE_URL'] ?? 'https://paysuite.tech'),
        },
        fetchImpl,
      );
    }
    throw new Error(`Unknown checkout gateway "${id}"`);
  };

  const primaryId = (env['CHECKOUT_PRIMARY'] ?? 'pawapay').toLowerCase();
  const backupId = (env['CHECKOUT_BACKUP'] ?? 'paysuite').toLowerCase();
  const chain = [build(primaryId)];
  if (backupId !== 'none' && backupId !== '' && backupId !== primaryId) chain.push(build(backupId));
  if (/localhost|127\.0\.0\.1/.test(publicApiUrl)) {
    // Gateways cannot reach localhost; callbacks will be missed (polling still works).
    console.warn('[checkout] PUBLIC_API_URL is local; gateway webhooks will not arrive.');
  }
  return {
    mode: 'live',
    chain,
    byId: new Map(chain.map((g) => [g.id, g])),
    mock: null,
    publicApiUrl,
    publicWebUrl,
  };
}

function required(env: Env, key: string): string {
  const v = env[key]?.trim();
  if (!v) throw new Error(`CHECKOUT_MODE=live needs ${key}`);
  return v;
}

function flag(v: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((v ?? '').trim().toLowerCase());
}

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '');
}
