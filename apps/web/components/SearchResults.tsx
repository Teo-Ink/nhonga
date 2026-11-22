import { Fragment } from 'react';
import { ListingRow } from './ListingRow';
import { AdSlot } from './AdSlot';
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

export interface CategoryChip {
  label: string;
  count: number;
  href: string;
  active: boolean;
}

/** Category shortcuts offered on an empty results page. */
const BROWSE = [
  'viaturas',
  'imoveis',
  'telemoveis',
  'electronica',
  'casa',
  'empregos',
  'servicos',
  'moda',
];

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
  correctedQuery,
  categoryChips,
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
  /** Spelling-corrected query the results are for, when the API had to correct it. */
  correctedQuery?: string | null;
  /** OLX-style category refinement chips with counts (search page only). */
  categoryChips?: CategoryChip[];
}) {
  const found = total === 1 ? t.search.found_one : fill(t.search.found_many, { n: total });
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

      <div className="results__head">
        <h1 className="section__title" id="results">
          {title}
        </h1>
        <div className="results__meta">
          <span className="results__count" role="status">
            {found}
          </span>
          <SaveSearch
            title={title}
            saveLabel={t.search.save_search}
            savedLabel={t.search.search_saved}
            alerts={{
              title: t.search.alert_title,
              sub: t.search.alert_sub,
              phonePh: t.search.alert_phone_ph,
              cta: t.search.alert_cta,
              sending: t.search.alert_sending,
              demo: t.search.alert_demo,
              done: t.search.alert_done,
              smsPreview: t.search.alert_sms_preview,
              none: t.search.alert_none,
              error: t.search.alert_error,
            }}
          />
          <SearchControls t={t} />
        </div>
      </div>

      <div className="searchlayout">
        <SearchFilters t={t} lockedCategory={lockedCategory} attributes={attributes} />

        <div className="searchlayout__main">
          {correctedQuery ? (
            <p className="results__corrected">
              {t.search.corrected} <strong>“{correctedQuery}”</strong>
            </p>
          ) : null}

          {categoryChips && categoryChips.length > 1 ? (
            <nav className="catchips" aria-label={t.search.in_categories}>
              {categoryChips.map((c) => (
                <a
                  key={c.href}
                  className={`catchip ${c.active ? 'is-active' : ''}`}
                  href={c.href}
                  aria-current={c.active ? 'true' : undefined}
                >
                  {c.label}
                  <span className="catchip__n">{c.count}</span>
                </a>
              ))}
            </nav>
          ) : null}

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
            // Not <EmptyState>: that wraps children in a <p>, and this block holds
            // a list and links (invalid inside <p> → hydration error).
            <div className="empty" role="status">
              <IconSearch width={40} height={40} />
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: 'var(--text)',
                  fontSize: 'var(--text-lg)',
                }}
              >
                {t.search.no_results_title}
              </p>
              <p className="noresults__tips-title">{t.search.tips_title}</p>
              <ul className="noresults__tips">
                <li>{t.search.tip_spelling}</li>
                <li>{t.search.tip_general}</li>
                <li>{t.search.tip_location}</li>
              </ul>
              {chips.length > 0 ? (
                <a className="btn btn--ghost noresults__clear" href={clearHref}>
                  {t.search.clear_filters}
                </a>
              ) : null}
              <p className="noresults__tips-title">{t.search.browse_title}</p>
              <div className="noresults__cats">
                {BROWSE.map((slug) => (
                  <a key={slug} className="catchip" href={`/categoria/${slug}`}>
                    {(t.categories as Record<string, string>)[slug] ?? slug}
                  </a>
                ))}
              </div>
              <p className="noresults__alert">{t.search.alert_hint}</p>
            </div>
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
        </aside>
      </div>
    </section>
  );
}
