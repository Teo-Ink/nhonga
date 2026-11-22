import { createHash, timingSafeEqual } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';

/**
 * Guard for the ops endpoints (`/ads/admin`, `/promotions/admin/active`,
 * `/saved-searches/run`, moderation). There is no admin role in the user model
 * yet, so access is a shared secret sent as `x-admin-token`, held in Secrets
 * Manager as ADMIN_API_TOKEN (at least 32 characters).
 *
 * Without the variable, or with a wrong token, the answer is 404: the endpoint
 * looks like it does not exist, which gives nothing away to someone probing.
 */
export const ADMIN_HEADER = 'x-admin-token';
const MIN_LENGTH = 32;

export function isAdminToken(
  presented: string | undefined,
  expected: string | undefined = process.env['ADMIN_API_TOKEN'],
): boolean {
  if (!expected || expected.length < MIN_LENGTH || !presented) return false;
  // Compare fixed-length digests so neither the length nor the content leaks
  // through timing.
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function assertAdmin(presented: string | undefined): void {
  if (!isAdminToken(presented)) throw new NotFoundException({ message: 'Not found' });
}
