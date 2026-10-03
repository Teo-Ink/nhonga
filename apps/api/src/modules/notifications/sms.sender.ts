import { Logger } from '@nestjs/common';

export interface SmsResult {
  /** True when the gateway accepted the message (always true in mock mode). */
  sent: boolean;
  /** 'mock' when logged only; 'live' when posted to a real gateway. */
  channel: 'mock' | 'live';
}

export interface SmsSender {
  send(toE164: string, message: string): Promise<SmsResult>;
}

/**
 * Logs the message and returns it as "sent" — the demo default, matching the
 * auth OTP mock. No real SMS leaves the machine.
 */
export class MockSmsSender implements SmsSender {
  private readonly log = new Logger('SMS');
  send(toE164: string, message: string): Promise<SmsResult> {
    this.log.log(`[mock SMS] to ${toE164}: ${message}`);
    return Promise.resolve({ sent: true, channel: 'mock' });
  }
}

/**
 * Posts to a generic JSON HTTP SMS gateway: `POST <url>` with
 * `{ to, message }` and a Bearer token. Most Mozambican/African gateways accept
 * this shape or are a thin adapter away; swap the body mapping for a specific
 * provider when a contract is signed. Failures are swallowed to `sent:false` so
 * a gateway outage never breaks the triggering action.
 */
export class HttpSmsSender implements SmsSender {
  private readonly log = new Logger('SMS');
  constructor(
    private readonly url: string,
    private readonly token: string | null,
    private readonly sender: string | null,
  ) {}

  async send(toE164: string, message: string): Promise<SmsResult> {
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (this.token) headers['authorization'] = `Bearer ${this.token}`;
      const res = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: toE164,
          message,
          ...(this.sender ? { from: this.sender } : {}),
        }),
      });
      if (!res.ok) {
        this.log.warn(`SMS gateway ${res.status} for ${toE164}`);
        return { sent: false, channel: 'live' };
      }
      return { sent: true, channel: 'live' };
    } catch (e) {
      this.log.warn(`SMS gateway error for ${toE164}: ${e instanceof Error ? e.message : e}`);
      return { sent: false, channel: 'live' };
    }
  }
}

/** Pick the live gateway only when SMS_MODE=live AND a URL is configured. */
export function createSmsSender(opts: {
  mode: string;
  gatewayUrl: string | null;
  gatewayToken: string | null;
  senderId: string | null;
}): SmsSender {
  if (opts.mode === 'live' && opts.gatewayUrl) {
    return new HttpSmsSender(opts.gatewayUrl, opts.gatewayToken, opts.senderId);
  }
  return new MockSmsSender();
}
