'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cents, formatMZN } from '@nhonga/shared';
import { pt } from '../../lib/i18n/pt';
import { IconUser, IconCart, IconShield, IconChevronLeft } from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';

interface OrderSummary {
  orderNumber: string;
  placedAt: string;
  grandTotalCents: number;
  paymentStatus: string;
  itemCount: number;
}

// Account. When signed in (phone OTP) it shows the user and their real orders;
// otherwise a guest sign-in prompt plus an order lookup. Auth is real; SMS is
// mocked (the code shows on the sign-in screen).
export default function AccountPage() {
  const t = pt.account;
  const router = useRouter();
  const { user, loading, signOut } = useSession();

  return (
    <section className="account">
      <h1 className="section__title">{t.title}</h1>

      {loading ? (
        <div className="empty" role="status">
          <p>{pt.common.loading}</p>
        </div>
      ) : user ? (
        <SignedIn
          name={user.displayName}
          phone={user.phoneE164}
          onSignOut={async () => {
            await signOut();
            router.refresh();
          }}
        />
      ) : (
        <Guest />
      )}
    </section>
  );
}

function SignedIn({
  name,
  phone,
  onSignOut,
}: {
  name: string;
  phone: string;
  onSignOut: () => void;
}) {
  const t = pt.account;
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);

  useEffect(() => {
    void fetch('/api/auth/orders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { orders: OrderSummary[] }) => setOrders(d.orders))
      .catch(() => setOrders([]));
  }, []);

  const statusLabel = (s: string): string =>
    s === 'paid'
      ? t.st_paid
      : s === 'awaiting_user'
        ? t.st_awaiting
        : s === 'failed'
          ? t.st_failed
          : t.st_other;

  return (
    <>
      <div className="card account__hello">
        <span className="account__icon" aria-hidden="true">
          <IconUser width={24} height={24} />
        </span>
        <div style={{ flex: 1 }}>
          <h2 className="card__title" style={{ marginBottom: 2 }}>
            {t.greeting.replace('{name}', name.split(' ')[0] ?? name)}
          </h2>
          <p className="account__muted">{phone}</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ maxWidth: 160 }}
          onClick={onSignOut}
        >
          {t.sign_out}
        </button>
      </div>

      <h2 className="card__title" style={{ marginTop: 'var(--space-2)' }}>
        {t.orders_title}
      </h2>
      {orders === null ? (
        <div className="empty" role="status">
          <p>{t.loading_orders}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty" role="status">
          <p>{t.no_orders}</p>
        </div>
      ) : (
        <ul className="orderlist">
          {orders.map((o) => (
            <li key={o.orderNumber}>
              <a className="orderrow" href={`/pedido/${o.orderNumber}`}>
                <span className="orderrow__main">
                  <span className="orderrow__ref">{o.orderNumber}</span>
                  <span className="orderrow__meta">
                    {new Date(o.placedAt).toLocaleDateString('pt-PT')} ·{' '}
                    {o.itemCount === 1 ? t.one_item : t.n_items.replace('{n}', String(o.itemCount))}
                  </span>
                </span>
                <span className="orderrow__right">
                  <span className="orderrow__total">{formatMZN(cents(o.grandTotalCents))}</span>
                  <span
                    className={`pill ${o.paymentStatus === 'paid' ? 'pill--ok' : 'pill--muted'}`}
                  >
                    {statusLabel(o.paymentStatus)}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <Shortcuts />
    </>
  );
}

function Guest() {
  const t = pt.account;
  const router = useRouter();
  const [ref, setRef] = useState('');

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    const clean = ref.trim().toUpperCase();
    if (clean === '') return;
    router.push(`/pedido/${encodeURIComponent(clean)}`);
  }

  return (
    <>
      <div className="account__grid">
        <div className="card account__signin">
          <span className="account__icon" aria-hidden="true">
            <IconUser width={24} height={24} />
          </span>
          <h2 className="card__title">{t.guest_title}</h2>
          <p className="account__muted">{t.guest_body}</p>
          <a className="btn btn--cta" href="/entrar">
            {t.sign_in}
          </a>
        </div>

        <form className="card" onSubmit={lookup}>
          <h2 className="card__title">{t.track_title}</h2>
          <p className="account__muted">{t.track_body}</p>
          <label className="field">
            <span className="sr-only">{t.track_title}</span>
            <input
              className="field__input"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder={t.track_ph}
              inputMode="text"
            />
          </label>
          <button type="submit" className="btn btn--primary">
            {t.track_cta}
          </button>
        </form>
      </div>
      <Shortcuts />
    </>
  );
}

function Shortcuts() {
  const t = pt.account;
  return (
    <>
      <h2 className="card__title" style={{ marginTop: 'var(--space-2)' }}>
        {t.links_title}
      </h2>
      <nav className="account__links" aria-label={t.links_title}>
        <a className="account__link" href="/carrinho">
          <IconCart width={20} height={20} />
          <span>{t.link_cart}</span>
          <IconChevronLeft width={16} height={16} className="account__link-arrow" />
        </a>
        <a className="account__link" href="/ajuda">
          <IconShield width={20} height={20} />
          <span>{t.link_help}</span>
          <IconChevronLeft width={16} height={16} className="account__link-arrow" />
        </a>
        <a className="account__link" href="/vender/comecar">
          <IconUser width={20} height={20} />
          <span>{t.link_sell}</span>
          <IconChevronLeft width={16} height={16} className="account__link-arrow" />
        </a>
      </nav>
    </>
  );
}
