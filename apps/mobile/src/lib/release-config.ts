/**
 * Release builds talk to the API over HTTPS only (P0-19): a session token or a
 * phone number must never cross a mobile network in clear text. Development
 * builds may use a LAN address over HTTP.
 */
export function assertReleaseApiUrl(url: string, isDev: boolean): void {
  if (!isDev && !url.startsWith('https://')) {
    throw new Error(`EXPO_PUBLIC_API_URL must be https:// in release builds (got ${url})`);
  }
}
