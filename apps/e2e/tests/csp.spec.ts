import { expect, test } from '@playwright/test';

// SEC-10: pages run under a nonce CSP without any blocked script, and the
// nonce changes on every request.
for (const path of ['/', '/produto/nissan-almera-2013', '/entrar', '/vender/novo']) {
  test(`no CSP violation on ${path}`, async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      // Script violations only: allowed image hosts depend on IMAGE_HOSTS.
      if (/script-src|Refused to execute/i.test(m.text())) violations.push(m.text());
    });
    const res = await page.goto(path);
    await page.waitForLoadState('networkidle');
    const csp = res?.headers()['content-security-policy'] ?? '';
    expect(csp).toMatch(/'nonce-[^']+'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(violations).toEqual([]);
  });
}

test('the nonce is new on every request', async ({ request }) => {
  const a = (await request.get('/')).headers()['content-security-policy'];
  const b = (await request.get('/')).headers()['content-security-policy'];
  expect(a).not.toEqual(b);
});
