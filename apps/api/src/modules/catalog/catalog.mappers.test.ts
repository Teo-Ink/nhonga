import { describe, expect, it } from 'vitest';
import {
  buildOptions,
  discountPercent,
  headlineVariant,
  pickText,
  toListItem,
  type ListItemInput,
  type VariantRow,
} from './catalog.mappers.js';

const v = (over: Partial<VariantRow>): VariantRow => ({
  id: 'v',
  sku: 's',
  options: {},
  priceCents: 1000,
  compareAtCents: null,
  stockQuantity: 5,
  isActive: true,
  ...over,
});

describe('catalog mappers', () => {
  it('is Portuguese-first, English only when asked and present', () => {
    expect(pickText('Camisa', 'Shirt', 'pt')).toBe('Camisa');
    expect(pickText('Camisa', 'Shirt', 'en')).toBe('Shirt');
    expect(pickText('Camisa', null, 'en')).toBe('Camisa'); // no EN -> fall back to PT
  });

  it('computes discount only when compare-at is genuinely higher', () => {
    expect(discountPercent(7500, 10000)).toBe(25);
    expect(discountPercent(10000, 10000)).toBeNull();
    expect(discountPercent(10000, null)).toBeNull();
  });

  it('headline price is the cheapest in-stock variant, not the cheapest overall', () => {
    const out = headlineVariant([
      v({ priceCents: 500, stockQuantity: 0 }), // cheaper but sold out
      v({ priceCents: 800, stockQuantity: 3 }),
    ]);
    expect(out?.priceCents).toBe(800);
  });

  it('falls back to cheapest overall when nothing is in stock', () => {
    const out = headlineVariant([
      v({ priceCents: 900, stockQuantity: 0 }),
      v({ priceCents: 700, stockQuantity: 0 }),
    ]);
    expect(out?.priceCents).toBe(700);
  });

  it('marks an option value available if any in-stock variant carries it', () => {
    const opts = buildOptions([
      v({ options: { Cor: 'Azul' }, stockQuantity: 0 }),
      v({ options: { Cor: 'Verde' }, stockQuantity: 4 }),
    ]);
    const cor = opts.find((o) => o.name === 'Cor');
    expect(cor?.values).toEqual([
      { value: 'Azul', available: false },
      { value: 'Verde', available: true },
    ]);
  });

  it('never claims free delivery (shipping is not built)', () => {
    const input: ListItemInput = {
      id: 'p',
      slug: 'p',
      titlePt: 'P',
      titleEn: null,
      ratingAvg: null,
      ratingCount: 0,
      postedAt: new Date('2026-01-02T00:00:00Z'),
      featuredUntil: null,
      categorySlug: 'viaturas',
      categoryNamePt: 'Viaturas',
      categoryNameEn: 'Vehicles',
      vendor: {
        id: 'x',
        slug: 'x',
        displayName: 'Loja',
        status: 'active',
        ratingAvg: null,
        ratingCount: 0,
        location: 'Maputo Cidade',
      },
      variants: [v({ priceCents: 1200, stockQuantity: 2 })],
      primaryImage: null,
    };
    const item = toListItem(input, 'pt');
    expect(item.freeDelivery).toBe(false);
    expect(item.priceCents).toBe(1200);
    expect(item.inStock).toBe(true);
    expect(item.location).toBe('Maputo Cidade');
    expect(item.postedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(item.vendor.isVerified).toBe(true);
    expect(item.featured).toBe(false);
  });

  it('maps the listing category, localized (PT-first, EN when asked)', () => {
    const input: ListItemInput = {
      id: 'p',
      slug: 'p',
      titlePt: 'P',
      titleEn: 'P',
      ratingAvg: null,
      ratingCount: 0,
      postedAt: null,
      featuredUntil: null,
      categorySlug: 'viaturas',
      categoryNamePt: 'Viaturas',
      categoryNameEn: 'Vehicles',
      vendor: {
        id: 'x',
        slug: 'x',
        displayName: 'Loja',
        status: 'active',
        ratingAvg: null,
        ratingCount: 0,
        location: null,
      },
      variants: [v({ priceCents: 1000, stockQuantity: 1 })],
      primaryImage: null,
    };
    expect(toListItem(input, 'pt').category).toEqual({ slug: 'viaturas', name: 'Viaturas' });
    expect(toListItem(input, 'en').category).toEqual({ slug: 'viaturas', name: 'Vehicles' });
  });

  it('marks a listing featured only while featuredUntil is in the future', () => {
    const base = {
      id: 'p',
      slug: 'p',
      titlePt: 'P',
      titleEn: null,
      ratingAvg: null,
      ratingCount: 0,
      postedAt: null,
      categorySlug: 'moda',
      categoryNamePt: 'Moda',
      categoryNameEn: 'Fashion',
      vendor: {
        id: 'x',
        slug: 'x',
        displayName: 'Loja',
        status: 'active',
        ratingAvg: null,
        ratingCount: 0,
        location: null,
      },
      variants: [v({ priceCents: 1000, stockQuantity: 1 })],
      primaryImage: null,
    };
    const future = toListItem({ ...base, featuredUntil: new Date(Date.now() + 60_000) }, 'pt');
    const past = toListItem({ ...base, featuredUntil: new Date(Date.now() - 60_000) }, 'pt');
    expect(future.featured).toBe(true);
    expect(past.featured).toBe(false);
  });
});
