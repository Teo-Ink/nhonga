'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cents, formatMZN } from '@nhonga/shared';
import { pt } from '../../../lib/i18n/pt';
import { IconCheck } from '../../../components/icons';

interface OrderView {
  orderNumber: string;
  placedAt: string;
  currency: string;
  itemsTotalCents: number;
  grandTotalCents: number;
  paymentStatus: string;
  paymentProvider: string;
  deliveryMethod: string;
  address: {
    recipientName: string;
    bairro: string;
    districtName: string;
    provinceName: string;
    landmark: string;
  };
  items: Array<{
    title: string;
    optionsLabel: string;
    imageUrl: string | null;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }>;
}

const WALLET_LABEL: Record<string, string> = {
  mpesa: 'M-Pesa',
  emola: 'e-Mola',
  mkesh: 'mKesh',
};

// Order confirmation + tracking. Reads the real placed order from the API by its
// number. While a wallet payment is still awaiting approval it polls a few times
// so the status reflects settlement without a manual refresh.
export default function OrderPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const t = pt.confirmation;
  const [order, setOrder] = useState<OrderView | null | undefined>(undefined);
  const polls = useRef(0);

  const load = useCallback(async (): Promise<OrderView | null> => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(ref)}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return (await res.json()) as OrderView;
    } catch {
      return null;
    }
  }, [ref]);

  useEffect(() => {
    let alive = true;
    void load().then((o) => {
      if (alive) setOrder(o);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  // Poll while a wallet payment is pending (settles in a few seconds via the mock).
  useEffect(() => {
    if (!order || order.paymentStatus !== 'awaiting_user' || order.paymentProvider === 'cod')
      return;
    if (polls.current >= 6) return;
    const timer = setTimeout(() => {
      polls.current += 1;
      void load().then((o) => {
        if (o) setOrder(o);
      });
    }, 3500);
    return () => clearTimeout(timer);
  }, [order, load]);

  if (order === undefined) {
    return (
      <div className="empty" role="status">
        <p>{pt.common.loading}</p>
      </div>
    );
  }

  if (order === null) {
    return (
      <div className="empty" role="status">
        <h1 className="section__title">{t.not_found_title}</h1>
        <p>{t.not_found_body}</p>
        <a className="btn btn--cta" href="/" style={{ maxWidth: 220 }}>
          {t.continue}
        </a>
      </div>
    );
  }

  const a = order.address;
  const isCod = order.paymentProvider === 'cod';
  const paid = order.paymentStatus === 'paid';
  const firstName = a.recipientName.split(' ')[0] ?? '';

  const steps = [
    { label: t.status_placed, done: true },
    { label: t.status_payment, done: paid },
    { label: t.status_preparing, done: false },
    { label: t.status_shipped, done: false },
    { label: t.status_delivered, done: false },
  ];

  return (
    <section className="confirm">
      <div className="confirm__hero">
        <span className="confirm__check" aria-hidden="true">
          <IconCheck width={26} height={26} />
        </span>
        <h1 className="section__title">{t.title}</h1>
        <p className="confirm__thanks">{t.thanks.replace('{name}', firstName)}</p>
        <p className="confirm__ref">
          {t.order_ref}: <strong>{order.orderNumber}</strong>
        </p>
        <p className="demo-banner" role="note">
          {t.demo_note}
        </p>
      </div>

      <div className="card">
        <h2 className="card__title">{t.whatsnext_title}</h2>
        <ol className="steps">
          {isCod ? (
            <li>{t.step_cod}</li>
          ) : (
            <li>{t.step_mm.replace('{wallet}', WALLET_LABEL[order.paymentProvider] ?? '')}</li>
          )}
          <li>{t.step_contact}</li>
        </ol>
        <p className="confirm__deliver">
          {order.deliveryMethod === 'pickup' ? (
            t.pickup_at
          ) : (
            <>
              {t.delivery_to}: {a.bairro}, {a.districtName}, {a.provinceName}
              {a.landmark ? ` — ${a.landmark}` : ''}
            </>
          )}
        </p>
      </div>

      <div className="card">
        <h2 className="card__title">{t.tracking_title}</h2>
        <ol className="timeline">
          {steps.map((s) => (
            <li key={s.label} className={`timeline__step ${s.done ? 'is-done' : 'is-pending'}`}>
              <span className="timeline__dot" aria-hidden="true">
                {s.done ? <IconCheck width={12} height={12} /> : null}
              </span>
              <span className="timeline__label">{s.label}</span>
            </li>
          ))}
        </ol>
        <p className="sumnote">{t.status_note}</p>
      </div>

      <div className="card">
        <h2 className="card__title">{t.items_title}</h2>
        <ul className="sumlist">
          {order.items.map((it, i) => (
            <li className="sumline" key={`${it.title}-${i}`}>
              <span className="sumline__media">
                {it.imageUrl ? (
                  <Image
                    src={it.imageUrl}
                    alt={it.title}
                    width={40}
                    height={40}
                    style={{ objectFit: 'cover' }}
                  />
                ) : null}
              </span>
              <span className="sumline__body">
                <span className="sumline__title">{it.title}</span>
                <span className="sumline__meta">
                  {it.optionsLabel} · ×{it.quantity}
                </span>
              </span>
              <span className="sumline__price">{formatMZN(cents(it.lineTotalCents))}</span>
            </li>
          ))}
        </ul>
        <div className="sumrow sumrow--total">
          <span>{t.total}</span>
          <span className="price__now">{formatMZN(cents(order.grandTotalCents))}</span>
        </div>
      </div>

      <a className="btn btn--cta" href="/" style={{ maxWidth: 260, margin: '0 auto' }}>
        {t.continue}
      </a>
    </section>
  );
}
