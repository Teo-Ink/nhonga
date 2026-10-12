import Image from 'next/image';
import { cents, formatMZN } from '@nhonga/shared';
import { IconMapPin, IconEye } from './icons';
import { FavoriteButton } from './FavoriteButton';
import type { ProductListItem } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

// Relative "posted" label from an ISO date, using the dictionary's words.
export function postedLabel(iso: string | null, l: Dictionary['listing']): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return l.today;
  if (days === 1) return l.yesterday;
  if (days < 14) return l.days_ago.replace('{n}', String(days));
  if (days < 60) return l.weeks_ago.replace('{n}', String(Math.floor(days / 7)));
  return l.months_ago.replace('{n}', String(Math.floor(days / 30)));
}

// Clean classifieds listing card (Wallapop/OLX-structured, Nhonga's brand): a
// favourite heart over the image, then title, price and a location + date row.
// The card is a positioned wrapper so the heart button is a sibling of the link
// (never nested inside the anchor).
export function ProductCard({ p, t }: { p: ProductListItem; t: Dictionary }) {
  const posted = postedLabel(p.postedAt, t.listing);
  return (
    <div className="lcard">
      <a className="lcard__link" href={`/produto/${p.slug}`}>
        <div className="lcard__media">
          {p.featured ? <span className="lcard__featured">{t.listing.featured}</span> : null}
          {p.discountPercent ? <span className="lcard__badge">-{p.discountPercent}%</span> : null}
          {p.bannerUrl ? (
            // A designed banner replaces the plain photo on the card — it already
            // carries the photo, price and a hook, so it stands out in the grid.
            <img className="lcard__bannerimg" src={p.bannerUrl} alt={p.title} loading="lazy" />
          ) : (
            (() => {
              const src = p.image?.url ?? `/ph?t=${encodeURIComponent(p.title)}`;
              const alt = p.image?.alt ?? p.title;
              // Generated /ph placeholders paint as a CSS background (reliable, never
              // unloads); real photos go through next/image for optimisation.
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
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  style={{ objectFit: 'cover' }}
                />
              );
            })()
          )}
          {!p.inStock ? <span className="lcard__soldout">{t.common.sold_out}</span> : null}
        </div>
        <div className="lcard__body">
          <span className="lcard__title">{p.title}</span>
          <span className="lcard__pricerow">
            <span className="lcard__price">{formatMZN(cents(p.priceCents))}</span>
            {p.compareAtCents ? (
              <span className="lcard__was">{formatMZN(cents(p.compareAtCents))}</span>
            ) : null}
          </span>
          <div className="lcard__meta">
            <span className="lcard__loc">
              <IconMapPin width={13} height={13} aria-hidden />
              {p.location ?? p.vendor.displayName}
            </span>
            {posted ? <span className="lcard__date">{posted}</span> : null}
            {p.views > 0 ? (
              <span
                className="lcard__views"
                title={t.listing.views.replace('{n}', String(p.views))}
              >
                <IconEye width={12} height={12} aria-hidden /> {p.views}
              </span>
            ) : null}
          </div>
        </div>
      </a>
      <FavoriteButton id={p.id} label={t.listing.save} />
    </div>
  );
}
