import { expect, test } from '@playwright/test';

// PRIV-01: the seller's number is not in the page; it arrives when the
// visitor asks for it.
test('the seller number is fetched only on "Ver número"', async ({ page, request }) => {
  const html = await (await request.get('/produto/capulana-tradicional')).text();
  expect(html).not.toMatch(/2588[2-7]\d{7}/);

  await page.goto('/produto/capulana-tradicional');
  const reveal = page.locator('.contactbox').getByRole('button', { name: /Ver número/ });
  await expect(reveal).toBeVisible();
  await reveal.click();
  await expect(page.locator('.contactbox a[href^="tel:+258"]')).toBeVisible();
});

test('a write to the BFF from another site is refused', async ({ request }) => {
  const res = await request.post('/api/track', {
    headers: { origin: 'https://evil.example' },
    data: { slug: 'capulana-tradicional', type: 'share' },
  });
  expect(res.status()).toBe(403);
});
