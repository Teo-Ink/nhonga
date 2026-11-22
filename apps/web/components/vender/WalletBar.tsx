'use client';
import { useEffect, useState } from 'react';
import { useDict } from '../i18n/DictProvider';
import { formatPrice } from '../../lib/format';

interface Pkg {
  id: string;
  name: string;
  priceCents: number;
  balanceCents: number;
  points: number;
}
type PayMethod = 'mpesa' | 'emola' | 'card';
const METHOD_LABEL: Record<PayMethod, string> = {
  mpesa: 'M-Pesa',
  emola: 'e-Mola',
  card: 'Visa',
};

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
// "Saldo em conta / Comprar pacote" header. Top-ups go through the hosted
// checkout (M-Pesa / e-Mola / Visa card): we create a payment, send the
// seller to the gateway's page, and /pagamento/[id] shows the outcome.
export function WalletBar({ reloadSignal = 0 }: { reloadSignal?: number }) {
  const dash = useDict().dash;
  const [w, setW] = useState<WalletView | null>(null);
  const [panel, setPanel] = useState<'none' | 'topup' | 'packages'>('none');
  const [amount, setAmount] = useState('');
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [method, setMethod] = useState<PayMethod>('mpesa');
  const [methods, setMethods] = useState<PayMethod[]>(['mpesa', 'emola']);

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
  }, [reloadSignal]);

  // "Tentar de novo" from /pagamento links here with ?carregar=1.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('carregar') === '1') openTopup();
  }, []);

  function loadMethods() {
    void fetch('/api/checkout/methods', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { methods?: PayMethod[] }) => {
        if (Array.isArray(d.methods) && d.methods.length > 0) {
          setMethods(d.methods);
          if (!d.methods.includes(method)) setMethod(d.methods[0] as PayMethod);
        }
      })
      .catch(() => undefined);
  }

  function openTopup() {
    setMsg(null);
    setPanel(panel === 'topup' ? 'none' : 'topup');
    loadMethods();
  }
  function openPackages() {
    setMsg(null);
    setPanel(panel === 'packages' ? 'none' : 'packages');
    loadMethods();
    if (pkgs.length === 0) {
      void fetch('/api/wallet/packages', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d: Pkg[]) => setPkgs(Array.isArray(d) ? d : []))
        .catch(() => setPkgs([]));
    }
  }

  async function submitTopup() {
    const mt = Number(amount.replace(/[^\d]/g, ''));
    if (!mt || mt < 10) {
      setMsg(dash.invalid_amount);
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/checkout/topup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountCents: mt * 100, method }),
      });
      const d = (await res.json()) as { checkoutUrl?: string; detail?: string; message?: string };
      if (!res.ok || !d.checkoutUrl) {
        setMsg(d.detail ?? d.message ?? dash.topup_fail);
        setBusy(false);
        return;
      }
      // Hand over to the gateway's hosted page; it sends the seller back to
      // /pagamento/[id] when they finish. Keep the button busy meanwhile.
      window.location.assign(d.checkoutUrl);
    } catch {
      setMsg(dash.topup_fail);
      setBusy(false);
    }
  }

  async function buy(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/checkout/package', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageId: id, method }),
      });
      const d = (await res.json()) as { checkoutUrl?: string; detail?: string; message?: string };
      if (!res.ok || !d.checkoutUrl) {
        setMsg(d.detail ?? d.message ?? dash.buy_fail);
        setBusy(false);
        return;
      }
      // Paid on the gateway's page; the package is credited once confirmed.
      window.location.assign(d.checkoutUrl);
    } catch {
      setMsg(dash.buy_fail);
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

  const balance = w ? formatPrice(w.balanceCents) : '—';
  const points = w ? w.points : 0;
  const proUntilLabel = w?.proUntil
    ? new Date(w.proUntil).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })
    : null;

  const picker = (
    <fieldset className="paymethods">
      <legend>{dash.pay_with}</legend>
      {methods.map((m) => (
        <label key={m} className={`paymethod paymethod--${m} ${method === m ? 'is-on' : ''}`}>
          <input
            type="radio"
            name="paymethod"
            value={m}
            checked={method === m}
            onChange={() => setMethod(m)}
          />
          <span className="paymethod__dot" aria-hidden="true" />
          <span className="paymethod__name">{METHOD_LABEL[m]}</span>
        </label>
      ))}
    </fieldset>
  );

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
          {picker}
          <button
            type="button"
            className="btn btn--cta btn--sm"
            onClick={() => void submitTopup()}
            disabled={busy || !w?.hasShop}
          >
            {busy ? dash.redirecting : dash.topup_submit}
          </button>
          <p className="wallet__secure">{dash.pay_secure}</p>
        </div>
      ) : null}

      {panel === 'packages' ? (
        <div className="wallet__panel wallet__packages">
          {picker}
          {pkgs.length === 0 ? (
            <p className="wallet__hint">A carregar pacotes…</p>
          ) : (
            pkgs.map((p) => (
              <div key={p.id} className="wallet__pkg">
                <div>
                  <strong>{p.name}</strong>
                  <span className="wallet__pkgmeta">
                    {formatPrice(p.balanceCents)} {dash.of_balance} · {p.points} {dash.pts}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--cta btn--sm"
                  onClick={() => void buy(p.id)}
                  disabled={busy || !w?.hasShop}
                >
                  {formatPrice(p.priceCents)}
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
