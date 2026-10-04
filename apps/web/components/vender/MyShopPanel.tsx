'use client';
import { useEffect, useState } from 'react';
import { cents, formatMZN } from '@nhonga/shared';
import { pt } from '../../lib/i18n/pt';
import { IconSearch } from '../icons';
import { useSession } from '../auth/SessionProvider';

interface MineItem {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  imageUrl: string | null;
  status: 'active' | 'sold' | 'archived' | string;
  inStock: boolean;
  views: number;
  contacts: number;
}
interface MineStats {
  active: number;
  sold: number;
  views: number;
  contacts: number;
  ratingAvg: number | null;
  ratingCount: number;
}
interface MineResponse {
  shop: { slug: string; displayName: string } | null;
  stats: MineStats;
  items: MineItem[];
}

// "A minha loja" — the signed-in seller's own listings, with manage actions.
// Client component: it reads the session, loads /api/mine/products, and lets the
// seller edit or remove each listing. Falls back to sign-in / empty states.
export function MyShopPanel() {
  const t = pt.sell;
  const { user, loading: sessionLoading } = useSession();
  const [data, setData] = useState<MineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'sold' | 'archived'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'recent' | 'price_asc' | 'price_desc'>('recent');

  function load(): Promise<void> {
    return fetch('/api/mine/products', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: MineResponse) => setData(d))
      .catch(() =>
        setData({
          shop: null,
          stats: { active: 0, sold: 0, views: 0, contacts: 0, ratingAvg: null, ratingCount: 0 },
          items: [],
        }),
      );
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionLoading]);

  async function remove(id: string) {
    if (!window.confirm(t.m_remove_confirm)) return;
    setRemoving(id);
    // Optimistic removal, then re-sync with the server to be certain.
    setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d));
    try {
      await fetch(`/api/listings/${id}`, { method: 'DELETE' });
    } finally {
      await load();
      setRemoving(null);
    }
  }

  async function setStatus(id: string, status: 'active' | 'sold') {
    setUpdating(id);
    setData((d) =>
      d ? { ...d, items: d.items.map((i) => (i.id === id ? { ...i, status } : i)) } : d,
    );
    try {
      await fetch(`/api/listings/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } finally {
      await load();
      setUpdating(null);
    }
  }

  if (loading || sessionLoading) {
    return <p className="account__muted">{t.edit_loading}</p>;
  }

  if (!user) {
    return (
      <div className="card myshop__empty">
        <p>{t.m_login}</p>
        <a className="btn btn--cta" href="/entrar">
          {t.m_login_cta}
        </a>
      </div>
    );
  }

  const allItems = data?.items ?? [];
  const byStatus = filter === 'all' ? allItems : allItems.filter((i) => i.status === filter);
  const q = search.trim().toLowerCase();
  const matched = q ? byStatus.filter((i) => i.title.toLowerCase().includes(q)) : byStatus;
  const items =
    sort === 'recent'
      ? matched
      : [...matched].sort((a, b) =>
          sort === 'price_asc' ? a.priceCents - b.priceCents : b.priceCents - a.priceCents,
        );
  const stats = data?.stats;
  const filters: { key: typeof filter; label: string; n: number }[] = [
    { key: 'all', label: t.m_filter_all, n: allItems.length },
    { key: 'active', label: t.st_active, n: allItems.filter((i) => i.status === 'active').length },
    { key: 'sold', label: t.st_sold, n: allItems.filter((i) => i.status === 'sold').length },
    {
      key: 'archived',
      label: t.st_archived,
      n: allItems.filter((i) => i.status === 'archived').length,
    },
  ];
  const statusLabel: Record<string, string> = {
    active: t.st_active,
    sold: t.st_sold,
    archived: t.st_archived,
  };

  return (
    <section className="myshop">
      <div className="dash__head">
        <div>
          <h1 className="section__title">{t.my_listings}</h1>
          {data?.shop ? <p className="dash__store">{data.shop.displayName}</p> : null}
        </div>
        <a className="btn btn--cta" href="/vender/novo">
          {t.m_new}
        </a>
      </div>

      <div className="myshop__stats">
        <div className="dash__stat">
          <strong>{stats?.active ?? 0}</strong>
          <span>{t.m_stat_active}</span>
        </div>
        <div className="dash__stat">
          <strong>{stats?.sold ?? 0}</strong>
          <span>{t.st_sold}</span>
        </div>
        <div className="dash__stat">
          <strong>{stats?.views ?? 0}</strong>
          <span>{t.m_stat_views}</span>
        </div>
        <div className="dash__stat">
          <strong>{stats?.contacts ?? 0}</strong>
          <span>{t.m_stat_contacts}</span>
        </div>
        <div className="dash__stat">
          <strong>{stats && stats.ratingAvg !== null ? stats.ratingAvg.toFixed(1) : '—'}</strong>
          <span>{t.m_stat_rating}</span>
        </div>
      </div>

      {allItems.length === 0 ? (
        <div className="card myshop__empty">
          <p>{t.m_empty}</p>
          <a className="btn btn--cta" href="/vender/novo">
            {t.m_empty_cta}
          </a>
        </div>
      ) : (
        <>
          <div className="myshop__filters" role="tablist">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                className={`mfilter ${filter === f.key ? 'is-on' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <span className="mfilter__n">{f.n}</span>
              </button>
            ))}
          </div>

          <div className="myshop__toolbar">
            <label className="myshop__search">
              <IconSearch width={18} height={18} aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.m_search_ph}
                aria-label={t.m_search_ph}
              />
            </label>
            <label className="myshop__sort">
              <span className="sr-only">{t.m_sort_label}</span>
              <select
                className="field__input"
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="recent">{t.m_sort_recent}</option>
                <option value="price_asc">{t.m_sort_price_asc}</option>
                <option value="price_desc">{t.m_sort_price_desc}</option>
              </select>
            </label>
          </div>

          <p className="myshop__count">{t.m_showing.replace('{n}', String(items.length))}</p>

          {items.length === 0 ? (
            <p className="account__muted myshop__none">—</p>
          ) : (
            <ul className="myshop__list">
              {items.map((p) => {
                const img = p.imageUrl ?? `/ph?t=${encodeURIComponent(p.title)}`;
                const busy = removing === p.id || updating === p.id;
                const removeLabel = removing === p.id ? t.m_removing : t.m_remove;
                return (
                  <li className={`mrow mrow--${p.status}`} key={p.id}>
                    <span
                      className="mrow__thumb"
                      aria-hidden="true"
                      style={{
                        backgroundImage: `url("${img.replace(/["\\]/g, encodeURIComponent)}")`,
                      }}
                    />
                    <div className="mrow__info">
                      <a className="mrow__title" href={`/produto/${p.slug}`}>
                        {p.title}
                      </a>
                      <span className="mrow__meta">
                        <span className="mrow__price">{formatMZN(cents(p.priceCents))}</span>
                        <span className={`mstatus mstatus--${p.status}`}>
                          {statusLabel[p.status] ?? p.status}
                        </span>
                      </span>
                      <span className="mrow__counts">
                        {p.views} {t.m_row_views} · {p.contacts} {t.m_row_contacts}
                      </span>
                    </div>
                    <div className="mrow__actions">
                      {p.status === 'active' ? (
                        <>
                          <a
                            className="btn btn--ghost btn--sm"
                            href={`/vender/anuncio/${p.slug}/editar`}
                          >
                            {t.m_edit}
                          </a>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setStatus(p.id, 'sold')}
                            disabled={busy}
                          >
                            {t.m_sold}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm mrow__del"
                            onClick={() => remove(p.id)}
                            disabled={busy}
                          >
                            {removeLabel}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => setStatus(p.id, 'active')}
                            disabled={busy}
                          >
                            {t.m_reactivate}
                          </button>
                          {p.status === 'sold' ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm mrow__del"
                              onClick={() => remove(p.id)}
                              disabled={busy}
                            >
                              {removeLabel}
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
