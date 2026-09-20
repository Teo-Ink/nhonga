import Image from 'next/image';
import { DealBadge, Price, Rating } from './ui';
import { IconCheck } from './icons';
import type { ProductListItem } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

// Fixed aspect ratio + object-fit keeps inconsistent seller photos orderly.
// next/image gives responsive srcset, lazy-loading, and reserved space (no CLS).
export function ProductCard({ p, t }: { p: ProductListItem; t: Dictionary }) {
  return (
    <a className="card" href={`/produto/${p.slug}`}>
      <div className="card__media">
        {p.discountPercent ? <DealBadge percent={p.discountPercent} /> : null}
        {p.image ? (
          <Image
            src={p.image.url}
            alt={p.image.alt ?? p.title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
            style={{ objectFit: 'cover' }}
          />
        ) : null}
      </div>
      <div className="card__body">
        <span className="card__title">{p.title}</span>
        <Price now={p.priceCents} was={p.compareAtCents} />
        <span className="card__vendor">
          <Rating value={p.ratingAvg} />
          <span>{p.vendor.displayName}</span>
          {p.vendor.isVerified ? (
            <IconCheck width={12} height={12} aria-label={t.common.verified} />
          ) : null}
          {!p.inStock ? <span className="badge badge--soldout">{t.common.sold_out}</span> : null}
        </span>
      </div>
    </a>
  );
}
