import { describe, expect, it } from 'vitest';
import { createSmsSender, MockSmsSender, HttpSmsSender } from './sms.sender.js';
import {
  createPushSender,
  isExpoPushToken,
  MockPushSender,
  ExpoPushSender,
} from './push.sender.js';

describe('SMS sender factory', () => {
  it('uses the mock in demo mode', () => {
    const s = createSmsSender({ mode: 'mock', gatewayUrl: 'https://x', gatewayToken: null, senderId: null });
    expect(s).toBeInstanceOf(MockSmsSender);
  });
  it('uses the HTTP gateway only when live AND a URL is configured', () => {
    expect(
      createSmsSender({ mode: 'live', gatewayUrl: 'https://sms', gatewayToken: 't', senderId: 'Nhonga' }),
    ).toBeInstanceOf(HttpSmsSender);
    // live but no URL → still mock (fails safe, never silently drops)
    expect(
      createSmsSender({ mode: 'live', gatewayUrl: null, gatewayToken: null, senderId: null }),
    ).toBeInstanceOf(MockSmsSender);
  });
  it('mock reports sent via the mock channel', async () => {
    const r = await new MockSmsSender().send('+258841234567', 'hi');
    expect(r).toEqual({ sent: true, channel: 'mock' });
  });
});

describe('push sender factory', () => {
  it('defaults to the real Expo sender', () => {
    expect(createPushSender({ mode: 'live', accessToken: null })).toBeInstanceOf(ExpoPushSender);
  });
  it('uses the mock only when explicitly disabled', () => {
    expect(createPushSender({ mode: 'mock', accessToken: null })).toBeInstanceOf(MockPushSender);
  });
});

describe('isExpoPushToken', () => {
  it('accepts valid Expo tokens', () => {
    expect(isExpoPushToken('ExponentPushToken[abc123]')).toBe(true);
    expect(isExpoPushToken('ExpoPushToken[xyz]')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isExpoPushToken('not-a-token')).toBe(false);
    expect(isExpoPushToken('')).toBe(false);
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false);
  });
});

describe('ExpoPushSender with no valid tokens', () => {
  it('accepts nothing and makes no request', async () => {
    const r = await new ExpoPushSender(null).send(['garbage', 'also-bad'], {
      title: 't',
      body: 'b',
    });
    expect(r).toEqual({ accepted: 0, channel: 'live' });
  });
});
