import { SESSION_COOKIE } from './bff';

/** The one place that decides how the session cookie is written. httpOnly, so
 *  page scripts never read the token; Secure wherever the site is on HTTPS. */
export const cookieSecure = (): boolean =>
  process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_INSECURE !== '1';

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 3600,
    secure: cookieSecure(),
  };
}
