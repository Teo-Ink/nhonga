/**
 * Hosted-checkout gateway contract.
 *
 * A gateway is a payment aggregator that hosts the payment page: we create a
 * payment, send the buyer to its page (where they pick the wallet and approve
 * on their phone), and it tells us the outcome. Nhonga never sees a PIN or a
 * phone-side approval. Adapters live in ./gateways.
 *
 * Trust model: a webhook is only a *hint* that something changed. Before money
 * is credited, the outcome is always re-read from the gateway's status API
 * (`status()`), and the amount is checked against what we asked for.
 */

export type GatewayId = 'pawapay' | 'paysuite' | 'mock';
export type PayMethod = 'mpesa' | 'emola' | 'mkesh' | 'card';
export const PAY_METHODS: readonly PayMethod[] = ['mpesa', 'emola', 'mkesh', 'card'];

export interface CreateCheckoutInput {
  /** Our intent id (UUID). Used as the gateway's idempotency key where supported. */
  readonly intentId: string;
  readonly amountCents: number;
  readonly method: PayMethod;
  /** Short text shown to the payer ("Carregamento Nhonga"). */
  readonly description: string;
  /** Where the gateway sends the buyer back to when they finish. */
  readonly returnUrl: string;
  /** Where the gateway posts status changes (when it supports per-payment URLs). */
  readonly webhookUrl: string;
}

export interface CreatedCheckout {
  /** The gateway's id for this payment; used for status queries. */
  readonly gatewayRef: string;
  /** Hosted page to send the buyer to. */
  readonly checkoutUrl: string;
}

export interface GatewayStatus {
  readonly status: 'pending' | 'paid' | 'failed';
  /** Amount the gateway says was collected, when it reports one. */
  readonly amountCents: number | null;
  readonly failureReason: string | null;
}

export interface WebhookInput {
  readonly headers: Readonly<Record<string, string | undefined>>;
  /** Exact bytes received; signatures are computed over these. */
  readonly rawBody: string;
}

export type WebhookResult =
  | { readonly valid: true; readonly gatewayRef: string }
  | { readonly valid: false; readonly reason: 'bad_signature' | 'malformed' };

export interface CheckoutGateway {
  readonly id: GatewayId;
  /** Wallets this gateway can collect from in Mozambique. */
  readonly methods: readonly PayMethod[];
  create(input: CreateCheckoutInput): Promise<CreatedCheckout>;
  /** Authoritative status. `createdAt` lets a gateway time out an abandoned page. */
  status(gatewayRef: string, createdAt?: Date): Promise<GatewayStatus>;
  /** Verify (if the gateway signs) and extract which payment changed. Pure. */
  parseWebhook(input: WebhookInput): WebhookResult;
}

/**
 * Thrown when a gateway could not be reached or failed on its side (network
 * error, timeout, 5xx). This — and only this — triggers failover to the backup
 * gateway. A 4xx means our request was wrong; retrying elsewhere would hide a
 * bug, so it is a plain Error instead.
 */
export class GatewayUnavailableError extends Error {
  constructor(
    readonly gateway: GatewayId,
    message: string,
  ) {
    super(message);
    this.name = 'GatewayUnavailableError';
  }
}

/** Minimal fetch signature so adapters can be unit-tested with a fake. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; text(): Promise<string> }>;

/** JSON request with a timeout; maps network failures and 5xx to GatewayUnavailableError. */
export async function requestJson(
  fetchImpl: FetchLike,
  gateway: GatewayId,
  url: string,
  init: { method: string; headers: Record<string, string>; body?: unknown },
  timeoutMs = 15_000,
): Promise<{ status: number; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const headers: Record<string, string> = { accept: 'application/json', ...init.headers };
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  let res: { status: number; text(): Promise<string> };
  try {
    res = await fetchImpl(url, {
      method: init.method,
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new GatewayUnavailableError(gateway, `${gateway} unreachable: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (res.status >= 500) {
    throw new GatewayUnavailableError(gateway, `${gateway} returned ${res.status}`);
  }
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

/** "500.00" from 50000 cents — the decimal-string amount both gateways expect. */
export function centsToDecimal(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

/** 50000 from "500.00" / 500 / "500"; null when not a number. */
export function decimalToCents(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
