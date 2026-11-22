import { expect, test } from '@playwright/test';

// Flow 1 — find something: search from the home page, open a listing.
test('search from the home page and open a listing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const box = page.getByRole('combobox', { name: /O que procura/ });
  await box.fill('toyota');
  await box.press('Enter');
  await page.waitForURL(/\/pesquisa/);
  const first = page.getByRole('link', { name: /Toyota/ }).first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/produto\//);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Toyota');
  // Contact is the point of a classifieds site.
  await expect(page.getByRole('link', { name: /WhatsApp/ }).first()).toBeVisible();
});

// Flow 2 — browse a category, sort by price.
test('browse a category and sort by lowest price', async ({ page }) => {
  await page.goto('/categoria/viaturas');
  await expect(page.getByRole('heading', { level: 1, name: 'Viaturas' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Ordenar' })
    .selectOption({ label: 'Preço: mais baixo' });
  await page.waitForURL(/sort=price_asc/);
  const prices = await page
    .locator('article .lrow__price')
    .evaluateAll((els) =>
      els.map((e) => Number((/[\d.]+/.exec(e.textContent ?? '')?.[0] ?? '0').replace(/\./g, ''))),
    );
  expect(prices.length).toBeGreaterThan(1);
  expect([...prices].sort((a, b) => a - b)).toEqual(prices);
});

// Flow 3 — report a listing, without an account.
test('report a suspicious listing', async ({ page }) => {
  await page.goto('/produto/nissan-almera-2013');
  await page.getByRole('button', { name: /Denunciar anúncio/ }).click();
  await page.getByRole('combobox', { name: 'Motivo' }).selectOption({ label: 'Fraude ou burla' });
  await page.getByRole('button', { name: 'Enviar denúncia' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'denúncia foi registada' }),
  ).toBeVisible();
});
