import { Logger } from '@nestjs/common';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  title: string;
  body: string;
  /** Arbitrary data delivered with the push (e.g. a deep-link href). */
  data?: Record<string, unknown>;
}
export interface PushResult {
  accepted: number;
  channel: 'mock' | 'live';
}

/** Expo push tokens look like `ExponentPushToken[...]` / `ExpoPushToken[...]`. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

export interface PushSender {
  send(tokens: string[], message: PushMessage): Promise<PushResult>;
}

export class MockPushSender implements PushSender {
  private readonly log = new Logger('Push');
  send(tokens: string[], message: PushMessage): Promise<PushResult> {
    this.log.log(`[mock push] ${tokens.length} device(s): ${message.title} — ${message.body}`);
    return Promise.resolve({ accepted: tokens.length, channel: 'mock' });
  }
}

/**
 * Sends through Expo's hosted push service — the real delivery path for Expo
 * apps, free and requiring no credentials (an optional access token adds
 * sender verification). Invalid tokens are filtered; the call is best-effort,
 * so an unreachable network never breaks the triggering action.
 */
export class ExpoPushSender implements PushSender {
  private readonly log = new Logger('Push');
  constructor(private readonly accessToken: string | null) {}

  async send(tokens: string[], message: PushMessage): Promise<PushResult> {
    const valid = tokens.filter(isExpoPushToken);
    if (valid.length === 0) return { accepted: 0, channel: 'live' };
    const messages = valid.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      sound: 'default' as const,
      ...(message.data ? { data: message.data } : {}),
    }));
    let accepted = 0;
    try {
      // Expo accepts up to 100 messages per request.
      for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          accept: 'application/json',
        };
        if (this.accessToken) headers['authorization'] = `Bearer ${this.accessToken}`;
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
        });
        if (res.ok) accepted += batch.length;
        else this.log.warn(`Expo push ${res.status}`);
      }
    } catch (e) {
      this.log.warn(`Expo push error: ${e instanceof Error ? e.message : e}`);
    }
    return { accepted, channel: 'live' };
  }
}

/** Mock only when explicitly disabled; otherwise the real Expo service (free). */
export function createPushSender(opts: { mode: string; accessToken: string | null }): PushSender {
  if (opts.mode === 'mock') return new MockPushSender();
  return new ExpoPushSender(opts.accessToken);
}
