import type { AuthService } from '../modules/auth/auth.service.js';

/** A fresh Mozambican number per call, so per-number limits never collide. */
export const freshPhone = (): string =>
  `84${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

/** Signs a brand-new user in through the real OTP flow (mock SMS). */
export async function signIn(auth: AuthService, phone = freshPhone()) {
  const { challengeId, devCode } = await auth.requestOtp(phone);
  return auth.verifyOtp(challengeId, devCode ?? '');
}
