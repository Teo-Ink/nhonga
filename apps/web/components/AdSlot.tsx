import type { Dictionary } from '../lib/i18n/index';

// A labelled advertising slot — the display-ad side of the classifieds revenue
// model (leaderboard banner, in-feed unit, side rectangle), alongside the
// seller-paid "destaque/turbo" boosts.
//
// For now every slot is a HOUSE ad: it promotes Nhonga's own paid features or
// invites a business to advertise. No third-party brands, logos or trackers —
// in production these slots would be filled from a house-ads table or a vetted
// ad partner. Always labelled "Publicidade" so it is never mistaken for a listing.
type Placement = 'leaderboard' | 'mpu' | 'inline';

// Which house promo each placement carries, and where it links.
const PROMO: Record<Placement, { kind: 'advertise' | 'promote' | 'sell'; href: string }> = {
  leaderboard: { kind: 'advertise', href: '/anunciar' },
  mpu: { kind: 'promote', href: '/vender/promover' },
  inline: { kind: 'promote', href: '/vender/promover' },
};

export function AdSlot({ t, placement }: { t: Dictionary; placement: Placement }) {
  const { kind, href } = PROMO[placement];
  const ad = t.ads[kind];
  return (
    <aside className={`adslot adslot--${placement}`} aria-label={t.ads.label}>
      <span className="adslot__label">{t.ads.label}</span>
      <a className="adslot__promo" href={href}>
        <span className="adslot__text">
          <strong className="adslot__title">{ad.title}</strong>
          <span className="adslot__body">{ad.body}</span>
        </span>
        <span className="adslot__cta">{ad.cta} →</span>
      </a>
    </aside>
  );
}
