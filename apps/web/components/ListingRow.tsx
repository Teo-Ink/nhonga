import Image from 'next/image';
import { IconMapPin, IconEye } from './icons';
import { FavoriteButton } from './FavoriteButton';
import { postedLabel } from './ProductCard';
import type { ProductListItem } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';
import { formatListingPrice, formatPrice, keyFacts } from '../lib/format';

// Gumtree-style list-view row (classifieds): thumbnail on the left, then the
// title, an attribute-summary line (the typed values joined), location and
// posted date; the price and a favourite heart sit on the right. Used on the
// search/category results pages; the home rails keep the grid card.
export function ListingRow({ p, t }: { p: ProductListItem; t: Dictionary }) {
  const posted = postedLabel(p.postedAt, t.listing);
  // OLX-style key facts for the category ("2016 · 120.000 km · Gasolina").
  const summary = keyFacts(p.attributes, p.category?.slug, t.listing.locale).join(' · ');

  return (
    <article className="lrow">
      <a className="lrow__link" href={`/produto/${p.slug}`}>
        <div className="lrow__media">
          {p.featured ? <span className="lcard__featured">{t.listing.featured}</span> : null}
          {p.bannerUrl ? (
            <img className="lcard__bannerimg" src={p.bannerUrl} alt={p.title} loading="lazy" />
          ) : (
            (() => {
              const src = p.image?.url ?? `/ph?t=${encodeURIComponent(p.title)}`;
              const alt = p.image?.alt ?? p.title;
              return src.startsWith('/ph') ? (
                <span
                  className="ph-bg"
                  role="img"
                  aria-label={alt}
                  style={{ backgroundImage: `url("${src.replace(/["\\]/g, encodeURIComponent)}")` }}
                />
              ) : (
                <Image
                  src={src}
                  alt={alt}
                  fill
                  sizes="(max-width: 768px) 40vw, 220px"
                  style={{ objectFit: 'cover' }}
                />
              );
            })()
          )}
        </div>
        <div className="lrow__body">
          <h3 className="lrow__title">{p.title}</h3>
          {summary ? <p className="lrow__specs">{summary}</p> : null}
          <div className="lrow__meta">
            <span className="lrow__loc">
              <IconMapPin width={13} height={13} aria-hidden />
              {p.location ?? p.vendor.displayName}
            </span>
            {posted ? <span className="lrow__date">{posted}</span> : null}
            {p.views > 0 ? (
              <span className="lrow__views">
                <IconEye width={13} height={13} aria-hidden /> {p.views}
              </span>
            ) : null}
          </div>
        </div>
        <div className="lrow__aside">
          <span className="lrow__price">
            {formatListingPrice(p.priceCents, p.category?.slug, t.listing.locale)}
          </span>
          {p.compareAtCents ? (
            <span className="lrow__was">{formatPrice(p.compareAtCents)}</span>
          ) : null}
        </div>
      </a>
      <FavoriteButton id={p.id} label={t.listing.save} />
    </article>
  );
}
