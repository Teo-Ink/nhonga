'use client';
import { useMemo, useState } from 'react';
import { cents, formatMZN } from '@nhonga/shared';
import { useCart } from './CartProvider';
import type { ProductDetail } from '../../lib/api';
import type { Dictionary } from '../../lib/i18n/index';

// Client buy box: pick one value per option group, resolve to a variant, add to
// the cart. With no option groups the single variant is used directly.
export function BuyBox({ product, t }: { product: ProductDetail; t: Dictionary }) {
  const { add } = useCart();
  const groups = product.options;
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const variant = useMemo(() => {
    if (product.variants.length === 1 && groups.length === 0) return product.variants[0];
    const keys = groups.map((g) => g.name);
    if (!keys.every((k) => selected[k])) return undefined;
    return product.variants.find((v) => keys.every((k) => v.options[k] === selected[k]));
  }, [product.variants, groups, selected]);

  const price = variant?.priceCents ?? product.priceCents;
  const canBuy = variant !== undefined && variant.inStock;

  function pick(group: string, value: string, available: boolean) {
    if (!available) return;
    setSelected((s) => ({ ...s, [group]: value }));
    setAdded(false);
  }

  function addToCart() {
    if (!variant) return;
    const label =
      groups.length > 0
        ? groups.map((g) => `${g.name}: ${selected[g.name]}`).join(' · ')
        : product.title;
    add({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      variantId: variant.id,
      variantLabel: label,
      priceCents: variant.priceCents,
      ...(product.images[0]?.url ? { image: product.images[0].url } : {}),
      vendorId: product.vendor.id,
      vendorName: product.vendor.displayName,
      qty: 1,
    });
    setAdded(true);
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.name} className="optgroup">
          <span className="optgroup__label">{group.name}</span>
          <div className="chips" role="group" aria-label={group.name}>
            {group.values.map((v) => {
              const on = selected[group.name] === v.value;
              return (
                <button
                  type="button"
                  key={v.value}
                  className={`chip${!v.available ? ' chip--off' : ''}${on ? ' chip--on' : ''}`}
                  aria-pressed={on}
                  aria-disabled={!v.available}
                  onClick={() => pick(group.name, v.value, v.available)}
                >
                  {v.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="buyblock">
        <div style={{ flex: '0 0 auto' }}>
          <span className="price__now" style={{ fontSize: 'var(--text-xl)' }}>
            {formatMZN(cents(price))}
          </span>
        </div>
        <button
          className="btn btn--cta"
          disabled={!canBuy}
          onClick={addToCart}
          style={{ flex: 1 }}
          aria-live="polite"
        >
          {added
            ? `✓ ${t.cart.added}`
            : !variant && groups.length > 0
              ? t.cart.choose_options
              : !canBuy
                ? t.common.sold_out
                : t.pdp.add_to_cart}
        </button>
      </div>
    </>
  );
}
