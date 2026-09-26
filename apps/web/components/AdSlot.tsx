import { getAd } from '../lib/api';
import type { Dictionary } from '../lib/i18n/index';

// A labelled advertising slot — the display-ad side of the classifieds revenue
// model (leaderboard banner, in-feed unit, side rectangle), alongside the
// seller-paid "destaque/turbo" boosts.
//
// It serves a real booked campaign when one is live for the slot/category
// (counting an impression); otherwise it falls back to a HOUSE ad promoting
// Nhonga's own features or inviting a business to advertise. Always labelled
// "Publicidade" so it is never mistaken for a listing.
type Placement = 'leaderboard' | 'mpu' | 'inline';
type Variant = 'advertise' | 'promote' | 'sell';

// Which house promo each placement carries by default, and where it links.
const PROMO: Record<Placement, { kind: Variant; href: string }> = {
  leaderboard: { kind: 'advertise', href: '/anunciar' },
  mpu: { kind: 'promote', href: '/vender/promover' },
  inline: { kind: 'promote', href: '/vender/promover' },
};
const HREF: Record<Variant, string> = {
  advertise: '/anunciar',
  promote: '/vender/promover',
  sell: '/vender/novo',
};

export async function AdSlot({
  t,
  placement,
  variant,
  category,
}: {
  t: Dictionary;
  placement: Placement;
  /** Overrides the default house promo for this placement (e.g. a second MPU). */
  variant?: Variant;
  /** Category context for ad targeting (results/category pages). */
  category?: string;
}) {
  const ad = await getAd(placement, category);

  return (
    <aside className={`adslot adslot--${placement}`} aria-label={t.ads.label}>
      <span className="adslot__label">{t.ads.label}</span>
      {ad ? (
        <a
          className="adslot__banner"
          href={`/api/ads/${ad.id}/click`}
          target="_blank"
          rel="noopener noreferrer sponsored"
        >
          <img src={ad.imageUrl} alt={ad.headline ?? ad.advertiser} loading="lazy" />
        </a>
      ) : (
        <HousePromo t={t} placement={placement} variant={variant} />
      )}
    </aside>
  );
}

function HousePromo({
  t,
  placement,
  variant,
}: {
  t: Dictionary;
  placement: Placement;
  variant?: Variant;
}) {
  const kind = variant ?? PROMO[placement].kind;
  const href = variant ? HREF[variant] : PROMO[placement].href;
  const ad = t.ads[kind];
  return (
    <a className="adslot__promo" href={href}>
      <span className="adslot__text">
        <strong className="adslot__title">{ad.title}</strong>
        <span className="adslot__body">{ad.body}</span>
      </span>
      <span className="adslot__cta">{ad.cta} →</span>
    </a>
  );
}
