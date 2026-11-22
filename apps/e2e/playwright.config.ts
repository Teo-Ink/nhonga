import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of the web site (P1-05), on a 360 px phone viewport — the
 * screen most Mozambican visitors use — against the real API and a Postgres
 * database loaded with the demo catalogue.
 *
 * Needs, before `pnpm --filter @nhonga/e2e e2e`:
 *   - the api and web builds (`pnpm build`);
 *   - E2E_DATABASE_URL: an empty, disposable database. The API's migrate script
 *     loads the demo catalogue into it (SEED_DEMO=1).
 * Playwright starts both servers itself. In CI, `npx playwright install
 * chromium`; locally, PLAYWRIGHT_CHROME_PATH can point at an installed Chrome.
 */
const API_PORT = 3100;
const WEB_PORT = 3101;
const db = process.env['E2E_DATABASE_URL'] ?? 'postgres://postgres:pg@localhost/nh_e2e';
const chrome = process.env['PLAYWRIGHT_CHROME_PATH'];

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 780 },
    locale: 'pt-MZ',
    trace: 'retain-on-failure',
    ...(chrome ? { launchOptions: { executablePath: chrome } } : {}),
  },
  projects: [{ name: 'mobile-360', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'node ../api/scripts/migrate.mjs && node ../api/dist/main.js',
      url: `http://localhost:${API_PORT}/health/live`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: {
        DATABASE_URL: db,
        SEED_DEMO: '1',
        NODE_ENV: 'staging',
        PORT: String(API_PORT),
        SMS_MODE: 'mock',
        PAYMENTS_MODE: 'mock',
        CHECKOUT_MODE: 'mock',
        OTP_RESEND_COOLDOWN_SECONDS: '1',
        OTP_MAX_GLOBAL_HOUR: '100000',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `pnpm --dir ../web exec next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/api/health`,
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
      env: {
        API_URL: `http://localhost:${API_PORT}`,
        SESSION_COOKIE_INSECURE: '1',
        CHECKOUT_SIMULATOR: '1',
      },
    },
  ],
});
