import { expect, type Page } from '@playwright/test';

/** A fresh Mozambican number per call (the API limits codes per number). */
export function freshPhone(): string {
  return `87${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
}

/**
 * Signs in through the real OTP flow. The API runs with simulated SMS, so the
 * code comes back in the response of /api/auth/request, as on staging.
 */
export async function signIn(page: Page, phone = freshPhone(), next = '/conta'): Promise<string> {
  await page.goto(`/entrar?next=${encodeURIComponent(next)}`);
  await page.getByRole('textbox', { name: /Telemóvel/ }).fill(phone);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/request') && r.ok()),
    page.getByRole('button', { name: 'Enviar código' }).click(),
  ]);
  const { devCode } = (await res.json()) as { devCode?: string };
  expect(devCode, 'the test API must run with SMS_MODE=mock').toMatch(/^\d{6}$/);
  await page.getByRole('textbox', { name: /Código de 6 dígitos/ }).fill(devCode!);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => u.pathname === next.split('?')[0]);
  return phone;
}
