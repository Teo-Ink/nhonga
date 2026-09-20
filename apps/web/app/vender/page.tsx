import { cents, formatMZN } from '@nhonga/shared';
import { VerifiedBadge } from '../../components/ui';
import { IconBox } from '../../components/icons';
import { listProductsByVendor } from '../../lib/api';
import { getDictionary } from '../../lib/i18n/index';

export const dynamic = 'force-dynamic';

// Seller dashboard. Not tied to an account yet, so for the demo it shows a real
// seed vendor's catalogue (Mama Rosa). The stat tiles are all derived from real
// catalogue data — product counts, stock, rating. Orders/revenue are NOT
// fabricated: the orders tile is an honest zero-state, since no order data
// exists. Clearly labelled as a demonstration.
const DEMO_VENDOR = 'mama-rosa';

export default async function SellerDashboard() {
  const { t } = await getDictionary();

  let items = [] as Awaited<ReturnType<typeof listProductsByVendor>>['items'];
  let vendor = null as Awaited<ReturnType<typeof listProductsByVendor>>['vendor'];
  try {
    const res = await listProductsByVendor(DEMO_VENDOR);
    items = res.items;
    vendor = res.vendor;
  } catch {
    // fall through to zero-state
  }

  const total = items.length;
  const inStock = items.filter((p) => p.inStock).length;
  const soldOut = total - inStock;
  const rated = items.filter((p) => p.ratingAvg !== null);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((n, p) => n + (p.ratingAvg ?? 0), 0) / rated.length).toFixed(1)
      : '—';

  return (
    <section className="dash">
      <div className="dash__head">
        <div>
          <h1 className="section__title">{t.sell.dash_title}</h1>
          {vendor ? (
            <p className="dash__store">
              {vendor.displayName}
              {vendor.isVerified ? <VerifiedBadge label={t.seller.verified} /> : null}
            </p>
          ) : null}
        </div>
        <a className="btn btn--cta" href="/vender/novo">
          {t.sell.new_listing}
        </a>
      </div>

      <p className="demo-banner" role="note">
        {t.sell.demo_note}
      </p>

      <div className="statgrid">
        <Stat label={t.sell.stat_products} value={String(total)} />
        <Stat label={t.sell.stat_instock} value={String(inStock)} />
        <Stat label={t.sell.stat_soldout} value={String(soldOut)} />
        <Stat label={t.sell.stat_rating} value={avgRating} />
        <Stat label={t.sell.stat_orders} value="0" note={t.sell.orders_note} />
      </div>

      <div className="dash__products">
        <div className="dash__products-head">
          <h2 className="card__title">{t.sell.products_title}</h2>
          {vendor ? (
            <a className="section__link" href={`/loja/${vendor.slug}`}>
              {t.sell.view_store} →
            </a>
          ) : null}
        </div>

        {total === 0 ? (
          <div className="empty" role="status">
            <IconBox />
            <p>{t.sell.empty_products}</p>
          </div>
        ) : (
          <table className="ptable">
            <thead>
              <tr>
                <th scope="col">{t.sell.col_product}</th>
                <th scope="col">{t.sell.col_price}</th>
                <th scope="col">{t.sell.col_status}</th>
                <th scope="col">
                  <span className="sr-only">{t.sell.edit}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <a className="ptable__name" href={`/produto/${p.slug}`}>
                      {p.title}
                    </a>
                  </td>
                  <td className="ptable__price">{formatMZN(cents(p.priceCents))}</td>
                  <td>
                    <span className={`pill ${p.inStock ? 'pill--ok' : 'pill--muted'}`}>
                      {p.inStock ? t.sell.status_active : t.sell.status_soldout}
                    </span>
                  </td>
                  <td className="ptable__action">
                    <a href="/vender/novo" className="ptable__edit">
                      {t.sell.edit}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
      {note ? <span className="stat__note">{note}</span> : null}
    </div>
  );
}
