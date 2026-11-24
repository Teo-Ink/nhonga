import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../db/types.js';
import { openTestDb } from '../../test/pg.js';
import { CatalogService } from './catalog.service.js';

// P1-01 acceptance: p95 < 300 ms with 50 000 listings. Runs only with BENCH=1
// against a database prepared with that volume (docs/audit/evidencias).
describe.skipIf(process.env['BENCH'] !== '1')('catalogue latency with 50 000 listings', () => {
  let db: Db;
  let close: () => Promise<void>;
  let catalog: CatalogService;

  beforeAll(() => {
    ({ db, close } = openTestDb());
    catalog = new CatalogService(db, {} as never, {} as never, {} as never, {} as never);
  });
  afterAll(async () => close());

  const cases: Array<[string, Parameters<CatalogService['listProducts']>[1]]> = [
    ['home', {}],
    ['category', { categorySlug: 'cat3' }],
    ['category + price sort', { categorySlug: 'cat5', sort: 'price_asc' }],
    ['price range', { minPriceCents: 100_000_00, maxPriceCents: 300_000_00 }],
    ['attribute', { categorySlug: 'cat2', attributes: { ano: { min: 2015 } } }],
    ['search 1 word', { q: 'hilux' }],
    ['search 2 words', { q: 'toyota corolla' }],
    ['search accent', { q: 'sofa matola' }],
    ['search typo', { q: 'geleria' }],
    ['search + category', { q: 'samsung', categorySlug: 'cat7' }],
  ];

  it('answers every query shape under 300 ms at p95', async () => {
    const report: string[] = [];
    let worst = 0;
    for (const [name, f] of cases) {
      const times: number[] = [];
      for (let i = 0; i < 25; i++) {
        const t = performance.now();
        await catalog.listProducts('pt', f);
        times.push(performance.now() - t);
      }
      times.sort((a, b) => a - b);
      const p50 = times[12]!;
      const p95 = times[23]!;
      worst = Math.max(worst, p95);
      report.push(
        `${name.padEnd(22)} p50 ${p50.toFixed(0).padStart(4)} ms  p95 ${p95.toFixed(0).padStart(4)} ms`,
      );
    }
    process.stdout.write(`\n${report.join('\n')}\n`);
    expect(worst).toBeLessThan(300);
  }, 300_000);
});
