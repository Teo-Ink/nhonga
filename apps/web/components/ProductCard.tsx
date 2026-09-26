import Image from 'next/image';
import { cents, formatMZN } from '@nhonga/shared';
import { IconMapPin } from './icons';
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
          {p.image ? (
            <Image
              src={p.image.url}
              alt={p.image.alt ?? p.title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
              style={{ objectFit: 'cover' }}
            />
          ) : null}
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
          </div>
        </div>
      </a>
      <FavoriteButton id={p.id} label={t.listing.save} />
    </div>
  );
}
