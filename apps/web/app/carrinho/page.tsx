'use client';
import Image from 'next/image';
import { cents, formatMZN } from '@nhonga/shared';
import { useCart } from '../../components/cart/CartProvider';
import { pt } from '../../lib/i18n/pt';

// Client cart page — reads the guest cart, groups by seller (a marketplace cart
// is multi-seller: delivery is quoted per seller). i18n is read directly here
// because this is a client route; PT for the local test env.
export default function CartPage() {
  const t = pt;
  const { items, setQty, remove, totalCents, count } = useCart();

  if (items.length === 0) {
    return (
      <div className="empty" role="status">
        <h1 className="section__title">{t.cart.empty_title}</h1>
        <p>{t.cart.empty_body}</p>
        <a className="btn btn--cta" href="/" style={{ maxWidth: 220 }}>
          {t.cart.empty_cta}
        </a>
      </div>
    );
  }

  // Group by vendor.
  const groups = new Map<string, { name: string; items: typeof items }>();
  for (const it of items) {
    if (!groups.has(it.vendorId)) groups.set(it.vendorId, { name: it.vendorName, items: [] });
    groups.get(it.vendorId)!.items.push(it);
  }

  return (
    <section className="section">
      <div className="results__head">
        <h1 className="section__title">{t.cart.title}</h1>
        <span className="results__count">
          {count === 1 ? t.cart.items_one : t.cart.items_many.replace('{n}', String(count))}
        </span>
      </div>

      {[...groups.values()].map((g) => {
        const subtotal = g.items.reduce((n, i) => n + i.priceCents * i.qty, 0);
        return (
          <div className="cartgroup" key={g.name}>
            <div className="cartgroup__head">
              {t.cart.sold_by} <strong>{g.name}</strong>
            </div>
            {g.items.map((it) => (
              <div className="cartline" key={it.variantId}>
                <div className="cartline__media">
                  {it.image ? (
                    <Image
                      src={it.image}
                      alt={it.title}
                      width={64}
                      height={64}
                      style={{ objectFit: 'cover' }}
                    />
                  ) : null}
                </div>
                <div className="cartline__body">
                  <a href={`/produto/${it.slug}`} className="cartline__title">
                    {it.title}
                  </a>
                  <span className="cartline__variant">{it.variantLabel}</span>
                  <span className="price__now" style={{ fontSize: 'var(--text-base)' }}>
                    {formatMZN(cents(it.priceCents))}
                  </span>
                </div>
                <div className="cartline__actions">
                  <div className="stepper" role="group" aria-label={t.cart.qty}>
                    <button
                      aria-label={t.cart.qty_decrease}
                      onClick={() => setQty(it.variantId, it.qty - 1)}
                    >
                      −
                    </button>
                    <span aria-live="polite">{it.qty}</span>
                    <button
                      aria-label={t.cart.qty_increase}
                      onClick={() => setQty(it.variantId, it.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button className="cartline__remove" onClick={() => remove(it.variantId)}>
                    {t.cart.remove}
                  </button>
                </div>
              </div>
            ))}
            <div className="cartgroup__subtotal">
              {t.cart.subtotal}: <strong>{formatMZN(cents(subtotal))}</strong>
            </div>
          </div>
        );
      })}

      <div className="cartsummary">
        <div className="cartsummary__row">
          <span>{t.cart.delivery}</span>
          <span className="cartsummary__muted">{t.cart.delivery_note}</span>
        </div>
        <div className="cartsummary__row cartsummary__total">
          <span>{t.cart.total}</span>
          <span className="price__now">{formatMZN(cents(totalCents))}</span>
        </div>
        <a className="btn btn--cta" href="/finalizar">
          {t.cart.checkout}
        </a>
      </div>
    </section>
  );
}
