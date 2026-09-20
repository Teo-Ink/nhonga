'use client';
import { use, useEffect, useState } from 'react';
import Image from 'next/image';
import { cents, formatMZN } from '@nhonga/shared';
import { pt } from '../../../lib/i18n/pt';
import { readDemoOrder, type DemoOrder } from '../../../lib/order-types';
import { IconCheck } from '../../../components/icons';

// Order confirmation. Reads the demo order the checkout screen just placed from
// sessionStorage (there is no wired guest-order endpoint in this env). Clearly
// labelled as a demonstration: no payment was taken and nothing ships.
export default function ConfirmationPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = use(params);
  const t = pt.confirmation;
  const [order, setOrder] = useState<DemoOrder | null | undefined>(undefined);

  useEffect(() => {
    setOrder(readDemoOrder(ref));
  }, [ref]);

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

  return (
    <section className="confirm">
      <div className="confirm__hero">
        <span className="confirm__check" aria-hidden="true">
          <IconCheck width={26} height={26} />
        </span>
        <h1 className="section__title">{t.title}</h1>
        <p className="confirm__thanks">
          {t.thanks.replace('{name}', order.name.split(' ')[0] ?? '')}
        </p>
        <p className="confirm__ref">
          {t.order_ref}: <strong>{order.ref}</strong>
        </p>
        <p className="demo-banner" role="note">
          {t.demo_note}
        </p>
      </div>

      <div className="card">
        <h2 className="card__title">{t.whatsnext_title}</h2>
        <ol className="steps">
          {order.paymentMethod === 'cod' ? (
            <li>{t.step_cod}</li>
          ) : (
            <li>{t.step_mm.replace('{wallet}', order.payWallet ?? '')}</li>
          )}
          <li>{t.step_contact}</li>
        </ol>

        <p className="confirm__deliver">
          {order.deliveryMethod === 'pickup' ? (
            t.pickup_at
          ) : a ? (
            <>
              {t.delivery_to}: {a.bairro}, {a.district}, {a.province}
              {a.landmark ? ` — ${a.landmark}` : ''}
            </>
          ) : null}
        </p>
      </div>

      <div className="card">
        <h2 className="card__title">{t.tracking_title}</h2>
        <ol className="timeline">
          {[
            t.status_placed,
            t.status_payment,
            t.status_preparing,
            t.status_shipped,
            t.status_delivered,
          ].map((label, i) => (
            <li key={label} className={`timeline__step ${i === 0 ? 'is-done' : 'is-pending'}`}>
              <span className="timeline__dot" aria-hidden="true">
                {i === 0 ? <IconCheck width={12} height={12} /> : null}
              </span>
              <span className="timeline__label">{label}</span>
            </li>
          ))}
        </ol>
        <p className="sumnote">{t.status_note}</p>
      </div>

      <div className="card">
        <h2 className="card__title">{t.items_title}</h2>
        <ul className="sumlist">
          {order.items.map((it) => (
            <li className="sumline" key={it.variantId}>
              <span className="sumline__media">
                {it.image ? (
                  <Image
                    src={it.image}
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
                  {it.variantLabel} · ×{it.qty}
                </span>
              </span>
              <span className="sumline__price">{formatMZN(cents(it.priceCents * it.qty))}</span>
            </li>
          ))}
        </ul>
        <div className="sumrow sumrow--total">
          <span>{t.total}</span>
          <span className="price__now">{formatMZN(cents(order.itemsTotalCents))}</span>
        </div>
      </div>

      <a className="btn btn--cta" href="/" style={{ maxWidth: 260, margin: '0 auto' }}>
        {t.continue}
      </a>
    </section>
  );
}
