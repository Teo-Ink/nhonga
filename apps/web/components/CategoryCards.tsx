import Image from 'next/image';
import type { ProductListItem } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

export interface CategoryCard {
  slug: string;
  label: string;
  items: ProductListItem[];
}

// Amazon-structured landing cards, in Nhonga's own look: a grid of cards, each
// with a heading, a tile grid of that category's real product images, and a
// see-all link. Only categories that actually have products are shown.
export function CategoryCards({ t, cards }: { t: Dictionary; cards: CategoryCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="section" aria-label={t.home.shop_by_category}>
      <div className="catcards">
        {cards.map((card) => (
          <div className="catcard" key={card.slug}>
            <h2 className="catcard__title">{card.label}</h2>
            <div className={`catcard__tiles catcard__tiles--${Math.min(card.items.length, 4)}`}>
              {card.items.slice(0, 4).map((p) => (
                <a className="catcard__tile" href={`/produto/${p.slug}`} key={p.id}>
                  <span className="catcard__img">
                    {p.image ? (
                      <Image
                        src={p.image.url}
                        alt={p.image.alt ?? p.title}
                        fill
                        sizes="(max-width: 640px) 45vw, 160px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : null}
                  </span>
                  <span className="catcard__tile-label">{p.title}</span>
                </a>
              ))}
            </div>
            <a className="catcard__more" href={`/categoria/${card.slug}`}>
              {t.common.see_all} →
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
