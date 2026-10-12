import type { Dictionary } from '../../lib/i18n/index';
import type { HomeStats } from '../../lib/api';

// Live social-proof strip under the hero: real marketplace totals (active
// listings, sellers, verified shops). Numbers use dot grouping to match the
// app's money style ("8.950"). Renders nothing if there is nothing to show.
export function StatStrip({ stats, t }: { stats: HomeStats; t: Dictionary['home'] }) {
  if (stats.listings <= 0) return null;
  const items = [
    { n: stats.listings, label: t.stat_listings },
    { n: stats.verifiedVendors, label: t.stat_verified },
    { n: stats.vendors, label: t.stat_vendors },
  ].filter((i) => i.n > 0);

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
