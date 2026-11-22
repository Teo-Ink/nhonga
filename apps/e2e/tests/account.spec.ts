import { expect, test } from '@playwright/test';
import { freshPhone, signIn } from './helpers';

// Flow 4 — sign in with a phone number and a code.
test('sign in with a phone number and see the account', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/conta/);
  await page.goto('/api/auth/me');
  await expect(page.locator('body')).toContainText('phoneE164');
});

// Flow 5 — publish: the form asks for sign-in at the end and keeps the draft.
test('publish a listing: sign in at the end, the draft survives', async ({ page }) => {
  const title = `Bicicleta de montanha ${Date.now() % 100000}`;
  await page.goto('/vender/novo');
  await page.getByRole('textbox', { name: 'Título do produto' }).fill(title);
  await page.getByRole('combobox', { name: 'Categoria' }).selectOption({ label: 'Casa e Cozinha' });
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Pouco usada, travões novos.');
  await page.getByRole('textbox', { name: 'Preço (MT)' }).fill('8500');
  await page.waitForTimeout(600); // the draft is saved after a short pause
  await page.getByRole('button', { name: /Publicar/ }).click();
  await page.waitForURL(/\/entrar/);

  await signIn(page, freshPhone(), '/vender/novo');
  await expect(page.getByRole('textbox', { name: 'Título do produto' })).toHaveValue(title);
  const shop = page.getByRole('textbox', { name: 'Nome da sua loja' });
  if (await shop.isVisible()) await shop.fill('Loja de Teste E2E');
  await page.getByRole('button', { name: /Publicar/ }).click();
  await page.waitForURL(/\/produto\//);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
});

// Flow 6 — message a seller, then the seller's side can block.
test('message a seller from a listing', async ({ page }) => {
  await signIn(page);
  await page.goto('/produto/nissan-almera-2013');
  await page.getByRole('link', { name: 'Enviar mensagem' }).first().click();
  await page.getByPlaceholder(/Escreva a sua pergunta/).fill('Ainda está disponível?');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await page.waitForURL(/\/mensagens\/[0-9a-f-]{36}/);
  await expect(page.getByText('Ainda está disponível?')).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Bloquear' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'bloqueou' })).toBeVisible();
});

// Flow 7 — delete the account from inside the product (app stores, law).
test('delete my account', async ({ page }) => {
  await signIn(page, freshPhone(), '/conta/privacidade');
  await expect(page.getByRole('heading', { name: 'Privacidade e conta' })).toBeVisible();
  const del = page.getByRole('button', { name: 'Eliminar a minha conta' });
  await expect(del).toBeDisabled();
  await page.getByRole('textbox', { name: /escreva ELIMINAR/ }).fill('eliminar');
  await del.click();
  await page.waitForURL(/conta=eliminada/);
  const me = await page.request.get('/api/auth/me');
  expect(await me.json()).toEqual({ user: null });
});
