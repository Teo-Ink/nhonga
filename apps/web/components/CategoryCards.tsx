import Image from 'next/image';
import { cents, formatMZN } from '@nhonga/shared';
import type { ProductListItem } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

export interface CategoryCard {
  slug: string;
  label: string;
  items: ProductListItem[];
}

// Amazon-structured landing cards in Nhonga's look: a grid of cards, each with a
// heading, a "from" price, a tile grid of that category's real products (image +
// title + price), and a see-all link. Only categories with products are shown.
export function CategoryCards({ t, cards }: { t: Dictionary; cards: CategoryCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="section" aria-label={t.home.shop_by_category}>
      <div className="section__head">
        <h2 className="section__title">{t.home.shop_by_category}</h2>
      </div>
      <div className="catcards">
        {cards.map((card) => {
          const min = Math.min(...card.items.map((p) => p.priceCents));
          const tiles = card.items.slice(0, 4);
          return (
            <div className="catcard" key={card.slug}>
              <div className="catcard__head">
                <h3 className="catcard__title">{card.label}</h3>
                <span className="catcard__from">
                  {t.home.from_price} {formatMZN(cents(min))}
                </span>
              </div>
              <div className={`catcard__tiles catcard__tiles--${tiles.length}`}>
                {tiles.map((p) => (
                  <a className="catcard__tile" href={`/produto/${p.slug}`} key={p.id}>
                    <span className="catcard__img">
                      {p.image ? (
                        <Image
                          src={p.image.url}
                          alt={p.image.alt ?? p.title}
                          fill
                          sizes="(max-width: 640px) 45vw, 150px"
                          style={{ objectFit: 'cover' }}
                        />
                      ) : null}
                      {p.discountPercent ? (
                        <span className="catcard__badge">-{p.discountPercent}%</span>
                      ) : null}
                    </span>
                    <span className="catcard__tile-title">{p.title}</span>
                    <span className="catcard__tile-price">{formatMZN(cents(p.priceCents))}</span>
                  </a>
                ))}
              </div>
              <a className="catcard__more" href={`/categoria/${card.slug}`}>
                {t.common.see_all} →
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
