import type { CartItem } from './cart-types';

// A demo order captured entirely on the client. There is no wired guest-checkout
// endpoint in the local/mock env, so the confirmation page reads the order the
// checkout screen just placed from sessionStorage. This is clearly labelled in
// the UI as a demonstration: no payment is taken and nothing ships.

export type DeliveryMethod = 'home' | 'pickup';
export type PaymentMethod = 'mpesa' | 'emola' | 'mkesh' | 'cod';

export interface DemoAddress {
  readonly province: string;
  readonly district: string;
  readonly bairro: string;
  readonly landmark: string;
  readonly house: string;
}

export interface DemoOrder {
  readonly ref: string;
  readonly placedAt: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
  readonly deliveryMethod: DeliveryMethod;
  readonly address: DemoAddress | null;
  readonly paymentMethod: PaymentMethod;
  readonly payWallet: string | null;
  readonly items: readonly CartItem[];
  readonly itemsTotalCents: number;
}

const ORDER_KEY = 'nhonga_order_';

/** Human-friendly, collision-resistant enough for a demo: NH-YYMMDD-XXXX. */
export function makeOrderRef(now = new Date()): string {
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `NH-${y}${m}${d}-${rand}`;
}

export function saveDemoOrder(order: DemoOrder): void {
  try {
    sessionStorage.setItem(ORDER_KEY + order.ref, JSON.stringify(order));
  } catch {
    /* private mode — the confirmation page will fall back to not-found */
  }
}

export function readDemoOrder(ref: string): DemoOrder | null {
  try {
    const raw = sessionStorage.getItem(ORDER_KEY + ref);
    return raw ? (JSON.parse(raw) as DemoOrder) : null;
  } catch {
    return null;
  }
}
