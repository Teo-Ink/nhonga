import type { Dictionary } from '../../lib/i18n/index';
import type { HomeStats } from '../../lib/api';

// Live social-proof strip under the hero: real marketplace totals (active
// listings, sellers, verified shops). Numbers use dot grouping to match the
// app's money style ("8.950"). Renders nothing if there is nothing to show.
// Small totals ("3 vendedores") make a marketplace look empty, so each number
// only shows once it clears a threshold; until then the strip stays hidden.
const MIN_SHOWN = { listings: 500, verifiedVendors: 25, vendors: 50 } as const;

export function StatStrip({ stats, t }: { stats: HomeStats; t: Dictionary['home'] }) {
  const items = [
    { n: stats.listings, min: MIN_SHOWN.listings, label: t.stat_listings },
    { n: stats.verifiedVendors, min: MIN_SHOWN.verifiedVendors, label: t.stat_verified },
    { n: stats.vendors, min: MIN_SHOWN.vendors, label: t.stat_vendors },
  ].filter((i) => i.n >= i.min);
  if (items.length === 0) return null;

  return (
    <section className="statstrip" aria-label={t.stat_listings}>
      {items.map((i) => (
        <div className="statstrip__item" key={i.label}>
          <span className="statstrip__n">{fmt(i.n)}</span>
          <span className="statstrip__label">{i.label}</span>
        </div>
      ))}
    </section>
  );
}

function fmt(n: number): string {
  // de-DE uses a dot as the thousands separator, matching formatMZN ("8.950").
  return n.toLocaleString('de-DE');
}
