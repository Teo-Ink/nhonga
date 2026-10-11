import { describe, expect, it } from 'vitest';
import { WalletService } from './wallet.service.js';
import type { PlanDto, PromotionsService } from '../promotions/promotions.service.js';

// boostPlans() and packages() depend only on PromotionsService / constants, not
// the DB, so we unit-test the money-pricing logic with lightweight doubles.
function makeService(plans: PlanDto[]): WalletService {
  const promotions = { listPlans: async () => plans } as unknown as PromotionsService;
  return new WalletService({} as never, {} as never, promotions);
}

describe('WalletService.boostPlans', () => {
  it('prices "feature" plans in balance and "bump" plans in points', async () => {
    const out = await makeService([
      { code: 'destaque', name: 'Destaque', kind: 'feature', priceCents: 15000, durationDays: 7 },
      { code: 'subir', name: 'Subir', kind: 'bump', priceCents: 5000, durationDays: 0 },
    ]).boostPlans('pt');

    expect(out.find((p) => p.code === 'destaque')).toMatchObject({
      kind: 'feature',
      priceCents: 15000,
      pointsCost: 0,
      durationDays: 7,
    });
    expect(out.find((p) => p.code === 'subir')).toMatchObject({
      kind: 'bump',
      priceCents: 0,
      pointsCost: 50, // 5000 cents (50 MT) -> 50 points
      durationDays: 0,
    });
  });

  it('bump point cost rounds to the nearest MT and never drops below 1', async () => {
    const out = await makeService([
      { code: 'cheap', name: 'C', kind: 'bump', priceCents: 40, durationDays: 0 }, // 0.4 -> 1
      { code: 'mid', name: 'M', kind: 'bump', priceCents: 12345, durationDays: 0 }, // 123.45 -> 123
    ]).boostPlans('pt');
    expect(out.find((p) => p.code === 'cheap')?.pointsCost).toBe(1);
    expect(out.find((p) => p.code === 'mid')?.pointsCost).toBe(123);
  });
});

describe('WalletService.packages', () => {
  it('offers three prepaid packages that credit a bonus over the price', () => {
    const packages = makeService([]).packages();
    expect(packages.map((p) => p.id)).toEqual(['basico', 'popular', 'pro']);
    for (const pkg of packages) {
      expect(pkg.balanceCents).toBeGreaterThanOrEqual(pkg.priceCents);
      expect(pkg.points).toBeGreaterThan(0);
    }
    // The bigger bundles give a genuine balance bonus (not just 1:1).
    const popular = packages.find((p) => p.id === 'popular');
    expect(popular?.balanceCents).toBeGreaterThan(popular?.priceCents ?? 0);
  });
});
