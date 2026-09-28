'use client';
import { useEffect, useState } from 'react';
import { pt } from '../../lib/i18n/pt';
import { useSession } from '../auth/SessionProvider';

// Owner-only control bar on a listing's detail page. If the signed-in viewer
// owns this listing (it appears in their /api/mine/products), it shows quick
// actions: edit, mark as sold, remove. Renders nothing for everyone else.
// A viewable detail is always 'active' (sold/archived listings 404), so after
// sold/remove we send the owner back to their shop panel.
export function OwnerControls({ productId, slug }: { productId: string; slug: string }) {
  const t = pt.sell;
  const { user, loading } = useSession();
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void fetch('/api/mine/products', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { items?: { id: string }[] }) =>
        setIsOwner(!!d.items?.some((i) => i.id === productId)),
      )
      .catch(() => setIsOwner(false));
  }, [user, loading, productId]);

  if (!isOwner) return null;

  async function markSold() {
    setBusy(true);
    try {
      await fetch(`/api/listings/${productId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'sold' }),
      });
      window.location.href = '/vender';
    } catch {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t.m_remove_confirm)) return;
    setBusy(true);
    try {
      await fetch(`/api/listings/${productId}`, { method: 'DELETE' });
      window.location.href = '/vender';
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="ownerbar" role="region" aria-label={t.owner_title}>
      <strong className="ownerbar__title">{t.owner_title}</strong>
      <div className="ownerbar__actions">
        <a className="btn btn--ghost btn--sm" href={`/vender/anuncio/${slug}/editar`}>
          {t.m_edit}
        </a>
        <button type="button" className="btn btn--ghost btn--sm" onClick={markSold} disabled={busy}>
          {t.m_sold}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm mrow__del"
          onClick={remove}
          disabled={busy}
        >
          {t.m_remove}
        </button>
      </div>
    </div>
  );
}
