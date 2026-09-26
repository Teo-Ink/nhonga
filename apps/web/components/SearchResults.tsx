import { Fragment } from 'react';
import { ListingRow } from './ListingRow';
import { AdSlot } from './AdSlot';
import { EmptyState } from './ui';
import { SaveSearch } from './SaveSearch';
import { SearchControls } from './SearchControls';
import { SearchFilters } from './SearchFilters';
import { IconSearch } from './icons';
import type { CategoryAttribute, ProductListItem } from '../lib/api';
import { fill, type Dictionary } from '../lib/i18n/index';

export interface ActiveChip {
  label: string;
  removeHref: string;
}

export interface Crumb {
  label: string;
  href?: string;
}

// eBay-structured results page: a left filter rail and a main column whose header
// carries the result count and a sort control. Optional breadcrumbs sit on top.
// `lockedCategory` fixes the category (used by category landing pages).
export function SearchResults({
  t,
  title,
  items,
  total,
  chips,
  clearHref,
  crumbs,
  lockedCategory,
  attributes,
}: {
  t: Dictionary;
  title: string;
  items: ProductListItem[];
  total: number;
  chips: ActiveChip[];
  clearHref: string;
  crumbs?: Crumb[];
  lockedCategory?: string;
  attributes?: CategoryAttribute[];
}) {
  return (
    <section className="section" aria-labelledby="results">
      {crumbs && crumbs.length > 0 ? (
        <nav className="crumbs" aria-label="breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="crumbs__item">
              {c.href ? <a href={c.href}>{c.label}</a> : <span aria-current="page">{c.label}</span>}
              {i < crumbs.length - 1 ? (
                <span className="crumbs__sep" aria-hidden="true">
                  /
                </span>
              ) : null}
            </span>
          ))}
        </nav>
      ) : null}

      <AdSlot t={t} placement="leaderboard" category={lockedCategory} />

      <div className="results__head">
        <h1 className="section__title" id="results">
          {title}
        </h1>
        <div className="results__meta">
          <span className="results__count">{fill(t.search.n_results, { n: total })}</span>
          <SaveSearch
            title={title}
            saveLabel={t.search.save_search}
            savedLabel={t.search.search_saved}
          />
          <SearchControls t={t} />
        </div>
      </div>

      <div className="searchlayout">
        <SearchFilters t={t} lockedCategory={lockedCategory} attributes={attributes} />

        <div className="searchlayout__main">
          {chips.length > 0 ? (
            <div className="filterchips" aria-label={t.search.filters}>
              {chips.map((c, i) => (
                <a className="filterchip" key={i} href={c.removeHref}>
                  {c.label}
                  <span aria-hidden>×</span>
                </a>
              ))}
              <a className="filterchip filterchip--clear" href={clearHref}>
                {t.search.clear_all}
              </a>
            </div>
          ) : null}

          {items.length === 0 ? (
            <EmptyState icon={<IconSearch width={40} height={40} />}>
              <strong
                style={{ display: 'block', color: 'var(--text)', fontSize: 'var(--text-lg)' }}
              >
                {t.search.no_results_title}
              </strong>
              {t.search.no_results_body}
              <a
                className="btn btn--ghost"
                href={clearHref}
                style={{ maxWidth: 240, marginTop: 8 }}
              >
                {t.search.clear_filters}
              </a>
            </EmptyState>
          ) : (
            <div className="lrows">
              {items.map((p, i) => (
                <Fragment key={p.id}>
                  {i === 4 && items.length > 4 ? (
                    <AdSlot t={t} placement="inline" category={lockedCategory} />
                  ) : null}
                  <ListingRow p={p} t={t} />
                </Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Right ad rail — desktop only (hidden on tablet/phone by CSS). */}
        <aside className="searchlayout__side" aria-label={t.ads.label}>
          <AdSlot t={t} placement="mpu" category={lockedCategory} variant="advertise" />
          <AdSlot t={t} placement="mpu" variant="promote" houseOnly />
        </aside>
      </div>
    </section>
  );
}
