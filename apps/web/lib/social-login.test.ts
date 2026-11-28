import { describe, expect, it } from 'vitest';
import {
  checkCallback,
  decodePending,
  encodePending,
  safeNext,
  sameState,
  type PendingSocial,
} from './social-login';

const pending: PendingSocial = {
  provider: 'google',
  state: 's'.repeat(43),
  nonce: 'n'.repeat(43),
  codeVerifier: 'v'.repeat(43),
  next: '/vender',
  mode: 'signin',
};
const cookie = encodePending(pending);
const back = (q: Record<string, string>) => new URLSearchParams(q);

describe('return from the provider', () => {
  it('completes when the state matches the one this browser was given', () => {
    expect(checkCallback('google', back({ state: pending.state, code: 'abc' }), cookie)).toEqual({
      ok: true,
      pending,
      code: 'abc',
    });
  });

  it('refuses an answer with another state (a link crafted by someone else)', () => {
    expect(checkCallback('google', back({ state: 'x'.repeat(43), code: 'abc' }), cookie)).toEqual({
      ok: false,
      reason: 'state_mismatch',
    });
    expect(checkCallback('google', back({ code: 'abc' }), cookie)).toEqual({
      ok: false,
      reason: 'state_mismatch',
    });
  });

  it('refuses when there is no pending sign-in, or it was for the other provider', () => {
    expect(checkCallback('google', back({ state: pending.state, code: 'abc' }), undefined)).toEqual(
      { ok: false, reason: 'expired' },
    );
    expect(checkCallback('facebook', back({ state: pending.state, code: 'abc' }), cookie)).toEqual({
      ok: false,
      reason: 'wrong_provider',
    });
  });

  it('treats "cancel" at the provider as a cancellation, not an error page', () => {
    expect(
      checkCallback('google', back({ state: pending.state, error: 'access_denied' }), cookie),
    ).toEqual({ ok: false, reason: 'cancelled' });
  });
});

describe('the pending cookie', () => {
  it('survives a round trip and rejects garbage', () => {
    expect(decodePending(cookie)).toEqual(pending);
    expect(decodePending('not-base64-json')).toBeNull();
    expect(decodePending(Buffer.from('{"provider":"evil"}').toString('base64url'))).toBeNull();
  });

  it('never keeps an outside address as the place to return to', () => {
    const evil = encodePending({ ...pending, next: 'https://evil.example/' });
    expect(decodePending(evil)?.next).toBe('/conta');
  });
});

describe('safeNext', () => {
  it('keeps internal paths only', () => {
    expect(safeNext('/vender?x=1')).toBe('/vender?x=1');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', '/api/auth/logout', ''])
      expect(safeNext(bad)).toBe('/conta');
    expect(safeNext(null, '/')).toBe('/');
  });
});

describe('sameState', () => {
  it('compares exactly', () => {
    expect(sameState('abc', 'abc')).toBe(true);
    expect(sameState('abc', 'abd')).toBe(false);
    expect(sameState('abc', 'abcd')).toBe(false);
  });
});
