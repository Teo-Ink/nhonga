import { ProductCard } from './ProductCard';
import type { ProductListItem } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

// A titled, horizontally-scrolling row of products (eBay-style carousel, in
// Nhonga's look). Falls back to nothing when empty so the home page stays clean.
export function ProductRail({
  t,
  title,
  items,
  seeAllHref,
}: {
  t: Dictionary;
  title: string;
  items: ProductListItem[];
  seeAllHref?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="rail" aria-label={title}>
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        {seeAllHref ? (
          <a className="section__link" href={seeAllHref}>
            {t.common.see_all} →
          </a>
        ) : null}
      </div>
      <div className="rail__track">
        {items.map((p) => (
          <div className="rail__item" key={p.id}>
            <ProductCard p={p} t={t} />
          </div>
        ))}
      </div>
    </section>
  );
}
