import { expect, test } from '@playwright/test';

// LEG-02: the complaints channel. Anyone can file one and gets a reference.
test('a visitor files a complaint and receives a reference', async ({ page }) => {
  await page.goto('/reclamacoes');
  await page.getByLabel('Nome').fill('Ana Teste');
  await page.getByLabel('Telemóvel ou email para a resposta').fill('ana@example.com');
  await page.getByLabel('Assunto').selectOption('payment');
  await page.getByLabel('O que aconteceu').fill('Carreguei a carteira e o saldo não apareceu.');
  await page.getByRole('button', { name: 'Enviar reclamação' }).click();
  await expect(page.getByRole('status')).toContainText(/R-\d{4}-[A-Z2-9]{6}/);
});
