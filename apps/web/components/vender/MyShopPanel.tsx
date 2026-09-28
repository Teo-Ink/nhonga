'use client';
import { useEffect, useState } from 'react';
import { cents, formatMZN } from '@nhonga/shared';
import { pt } from '../../lib/i18n/pt';
import { useSession } from '../auth/SessionProvider';

interface MineItem {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  imageUrl: string | null;
  status: 'active' | 'sold' | 'archived' | string;
  inStock: boolean;
}
interface MineResponse {
  shop: { slug: string; displayName: string } | null;
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

  function load(): Promise<void> {
    return fetch('/api/mine/products', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: MineResponse) => setData(d))
      .catch(() => setData({ shop: null, items: [] }));
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
    setRemoving(id);
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
      setRemoving(null);
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

  const items = data?.items ?? [];
  const activeCount = items.filter((i) => i.status === 'active').length;
  const soldCount = items.filter((i) => i.status === 'sold').length;
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
          <strong>{activeCount}</strong>
          <span>{t.m_stat_active}</span>
        </div>
        <div className="dash__stat">
          <strong>{soldCount}</strong>
          <span>{t.st_sold}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card myshop__empty">
          <p>{t.m_empty}</p>
          <a className="btn btn--cta" href="/vender/novo">
            {t.m_empty_cta}
          </a>
        </div>
      ) : (
        <ul className="myshop__list">
          {items.map((p) => {
            const img = p.imageUrl ?? `/ph?t=${encodeURIComponent(p.title)}`;
            const busy = removing === p.id;
            return (
              <li className={`mrow mrow--${p.status}`} key={p.id}>
                <span
                  className="mrow__thumb"
                  aria-hidden="true"
                  style={{ backgroundImage: `url("${img.replace(/["\\]/g, encodeURIComponent)}")` }}
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
                        {busy ? t.m_removing : t.m_remove}
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
                          {busy ? t.m_removing : t.m_remove}
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
    </section>
  );
}
