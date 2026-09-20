import { ProductCard } from './ProductCard';
import { EmptyState } from './ui';
import { SearchControls } from './SearchControls';
import { IconSearch } from './icons';
import type { ProductListItem } from '../lib/api';
import { fill, type Dictionary } from '../lib/i18n/index';

export interface ActiveChip {
  label: string;
  removeHref: string;
}

export function SearchResults({
  t,
  title,
  items,
  total,
  chips,
  clearHref,
}: {
  t: Dictionary;
  title: string;
  items: ProductListItem[];
  total: number;
  chips: ActiveChip[];
  clearHref: string;
}) {
  return (
    <section className="section" aria-labelledby="results">
      <div className="results__head">
        <h1 className="section__title" id="results">
          {title}
        </h1>
        <span className="results__count">{fill(t.search.n_results, { n: total })}</span>
      </div>

      <SearchControls t={t} />

      {chips.length > 0 ? (
        <div className="filterchips" aria-label={t.search.filters}>
          {chips.map((c, i) => (
            <a className="filterchip" key={i} href={c.removeHref}>
              {c.label}
              <span aria-hidden>×</span>
            </a>
          ))}
          <a className="filterchip filterchip--clear" href={clearHref}>
            {t.search.clear_filters}
          </a>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon={<IconSearch width={40} height={40} />}>
          <strong style={{ display: 'block', color: 'var(--text)', fontSize: 'var(--text-lg)' }}>
            {t.search.no_results_title}
          </strong>
          {t.search.no_results_body}
          <a className="btn btn--ghost" href={clearHref} style={{ maxWidth: 240, marginTop: 8 }}>
            {t.search.clear_filters}
          </a>
        </EmptyState>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}
