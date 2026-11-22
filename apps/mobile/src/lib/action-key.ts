/**
 * Idempotency keys for payments (P2-11), same rule as the web: one key per
 * intended action, kept while the person repeats that same action (a second
 * tap, a retry after the network dropped), new once it changes or succeeded.
 * The API then charges once.
 */
export function newKey(rand: () => number = Math.random): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  return `app-${Date.now().toString(36)}-${hex(24)}`;
}

export class ActionKeys {
  private cur: { action: string; key: string } | null = null;
  private readonly make: () => string;

  constructor(make: () => string = () => newKey()) {
    this.make = make;
  }

  /** The key for this action (e.g. "topup:5000"). */
  keyFor(action: string): string {
    if (!this.cur || this.cur.action !== action) this.cur = { action, key: this.make() };
    return this.cur.key;
  }

  /** Call after the action succeeded, so the next one gets a fresh key. */
  done(): void {
    this.cur = null;
  }
}
