'use client';
import { useEffect, useState } from 'react';
import { cents, formatMZN } from '@nhonga/shared';
import { useDict } from '../i18n/DictProvider';

interface Pkg {
  id: string;
  name: string;
  priceCents: number;
  balanceCents: number;
  points: number;
}
interface WalletView {
  hasShop: boolean;
  shopName: string | null;
  balanceCents: number;
  points: number;
  isPro: boolean;
  proUntil: string | null;
  transactions: { id: string; kind: string; amountCents: number; points: number }[];
}

// Seller wallet strip for "Os teus anúncios": balance (MZN) + loyalty points,
// with inline top-up and prepaid-package panels. Mirrors the marketplace
// "Saldo em conta / Comprar pacote" header. Top-ups are demo credits.
export function WalletBar({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const dash = useDict().dash;
  const [w, setW] = useState<WalletView | null>(null);
  const [panel, setPanel] = useState<'none' | 'topup' | 'packages'>('none');
  const [amount, setAmount] = useState('');
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function loadWallet() {
    return fetch('/api/wallet', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: WalletView) => setW(d))
      .catch(() =>
        setW({
          hasShop: false,
          shopName: null,
          balanceCents: 0,
          points: 0,
          isPro: false,
          proUntil: null,
          transactions: [],
        }),
      );
  }

  useEffect(() => {
    void loadWallet();
    // eslint-disable-next-line
  }, [reloadSignal]);

  function openTopup() {
    setMsg(null);
    setPanel(panel === 'topup' ? 'none' : 'topup');
  }
  function openPackages() {
    setMsg(null);
    setPanel(panel === 'packages' ? 'none' : 'packages');
    if (pkgs.length === 0) {
      void fetch('/api/wallet/packages', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: Pkg[]) => setPkgs(Array.isArray(d) ? d : []))
        .catch(() => setPkgs([]));
    }
  }

  async function submitTopup() {
    const mt = Number(amount.replace(/[^\d]/g, ''));
    if (!mt || mt <= 0) {
      setMsg(dash.invalid_amount);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountCents: mt * 100 }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.detail ?? d.message ?? dash.topup_fail);
        return;
      }
      setW(d);
      setAmount('');
      setPanel('none');
      setMsg(`${dash.topped_up}: +${formatMZN(cents(mt * 100))}`);
    } finally {
      setBusy(false);
    }
  }

  async function buy(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/wallet/purchase', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageId: id }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.detail ?? d.message ?? dash.buy_fail);
        return;
      }
      setW(d);
      setPanel('none');
      setMsg(dash.package_added);
    } finally {
      setBusy(false);
    }
  }

  async function subscribePro() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/wallet/pro', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.detail ?? d.message ?? dash.pro_fail);
        return;
      }
      setW(d);
      setMsg(dash.pro_activated);
    } finally {
      setBusy(false);
    }
  }

  const balance = w ? formatMZN(cents(w.balanceCents)) : '—';
  const points = w ? w.points : 0;
  const proUntilLabel = w?.proUntil
    ? new Date(w.proUntil).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
    : null;

  return (
    <div className="wallet">
      <div className="wallet__bar">
        <div className="wallet__figures">
          <span className="wallet__label">
            {dash.balance}: <strong>{balance}</strong>
          </span>
          <span className="wallet__label wallet__label--pts">
            {dash.points}:{' '}
            <strong>
              {points} {dash.pts}
            </strong>
          </span>
        </div>
        <div className="wallet__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={openTopup}>
            {dash.topup}
          </button>
          <button type="button" className="btn btn--cta btn--sm" onClick={openPackages}>
            {dash.buy_package}
          </button>
        </div>
      </div>

      {w?.hasShop ? (
        <div className={`wallet__pro ${w.isPro ? 'is-on' : ''}`}>
          <span className="wallet__prolabel">
            {w.isPro ? (
              <>
                ★ <strong>{dash.pro_name}</strong> {dash.pro_active_until} {proUntilLabel}
              </>
            ) : (
              <>
                <strong>{dash.pro_name}</strong> — {dash.pro_offer}
              </>
            )}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => void subscribePro()}
            disabled={busy}
          >
            {w.isPro ? dash.renew : dash.activate}
          </button>
        </div>
      ) : null}

      {w && !w.hasShop ? <p className="wallet__hint">{dash.wallet_hint}</p> : null}
      {msg ? <p className="wallet__msg">{msg}</p> : null}

      {panel === 'topup' ? (
        <div className="wallet__panel">
          <label className="wallet__field">
            <span>{dash.topup_amount}</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex.: 500"
              aria-label={dash.topup_amount}
            />
          </label>
          <div className="wallet__quick">
            {[100, 500, 1000].map((v) => (
              <button
                key={v}
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setAmount(String(v))}
              >
                {v} MT
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--cta btn--sm"
            onClick={() => void submitTopup()}
            disabled={busy || !w?.hasShop}
          >
            {busy ? dash.loading : dash.topup_submit}
          </button>
        </div>
      ) : null}

      {panel === 'packages' ? (
        <div className="wallet__panel wallet__packages">
          {pkgs.length === 0 ? (
            <p className="wallet__hint">A carregar pacotes…</p>
          ) : (
            pkgs.map((p) => (
              <div key={p.id} className="wallet__pkg">
                <div>
                  <strong>{p.name}</strong>
                  <span className="wallet__pkgmeta">
                    {formatMZN(cents(p.balanceCents))} {dash.of_balance} · {p.points} {dash.pts}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--cta btn--sm"
                  onClick={() => void buy(p.id)}
                  disabled={busy || !w?.hasShop}
                >
                  {formatMZN(cents(p.priceCents))}
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
