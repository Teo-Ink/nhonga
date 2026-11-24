import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// P2-09: no serious or critical WCAG 2.1 A/AA violation on the pages a
// visitor meets first, at 360 px.
const PAGES = [
  '/',
  '/categoria/viaturas',
  '/produto/nissan-almera-2013',
  '/entrar',
  '/vender/novo',
  '/pesquisa?q=toyota',
  '/loja/mama-rosa',
  '/reclamacoes',
  '/termos',
  '/privacidade',
];

for (const path of PAGES) {
  test(`accessibility: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(' ')}`);
    expect(serious).toEqual([]);
  });
}
