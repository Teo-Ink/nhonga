import { expect, test } from '@playwright/test';

// AUTH-10: sign in with Google/Facebook. The providers themselves are not
// reachable from tests, so this covers what the site does around them.

test('no Google/Facebook buttons while no provider is configured', async ({ page, request }) => {
  const res = await request.get('/api/auth/social/providers');
  expect(await res.json()).toEqual({ providers: [] });

  await page.goto('/entrar');
  await expect(page.getByRole('button', { name: /enviar código/i })).toBeVisible();
  await expect(page.locator('.social-btn')).toHaveCount(0);
});

test('a return from a provider that this browser did not start is refused', async ({ page }) => {
  // No pending sign-in cookie: a crafted link must not sign anyone in.
  await page.goto('/api/auth/social/google/callback?state=forged-state-value&code=stolen-code');
  await expect(page).toHaveURL(/\/entrar\?erro=social/);
  await expect(page.getByRole('alert').first()).toContainText(/não foi possível entrar/i);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'nhonga_session')).toBeUndefined();
});

test('starting with an unconfigured or unknown provider returns to sign-in', async ({ page }) => {
  await page.goto('/api/auth/social/google/start');
  await expect(page).toHaveURL(/\/entrar\?erro=social/);
  await page.goto('/api/auth/social/twitter/start');
  await expect(page).toHaveURL(/\/entrar\?erro=social/);
});
