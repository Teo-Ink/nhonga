'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cents, formatMZN, isValidMzMsisdn, suggestedWalletFor } from '@nhonga/shared';
import { useCart } from '../../components/cart/CartProvider';
import { pt } from '../../lib/i18n/pt';
import {
  makeOrderRef,
  saveDemoOrder,
  type DeliveryMethod,
  type PaymentMethod,
} from '../../lib/order-types';

// Real Mozambican provinces — geographic facts, not demo business data.
const PROVINCES = [
  'Maputo Cidade',
  'Maputo Província',
  'Gaza',
  'Inhambane',
  'Sofala',
  'Manica',
  'Tete',
  'Zambézia',
  'Nampula',
  'Cabo Delgado',
  'Niassa',
] as const;

const WALLET_LABEL: Record<string, string> = {
  mpesa: 'M-Pesa',
  emola: 'e-Mola',
  mkesh: 'mKesh',
};

// Guest checkout. Mobile-money-first, informal addressing (bairro + reference
// point), and a total-before-confirm summary. There is no wired guest-checkout
// endpoint in this env, so the order is captured client-side and clearly
// labelled as a demonstration — no real payment, no shipment.
export default function CheckoutPage() {
  const t = pt.checkout;
  const router = useRouter();
  const { items, totalCents, clear } = useCart();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<DeliveryMethod>('home');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [bairro, setBairro] = useState('');
  const [landmark, setLandmark] = useState('');
  const [house, setHouse] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('mpesa');
  const [payPhone, setPayPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isMobileMoney = payment !== 'cod';
  const effectivePayPhone = payPhone.trim() === '' ? phone : payPhone;
  const suggestedWallet = useMemo(
    () => (isValidMzMsisdn(effectivePayPhone) ? suggestedWalletFor(effectivePayPhone) : null),
    [effectivePayPhone],
  );

  const phoneValid = isValidMzMsisdn(phone);
  const payPhoneValid = !isMobileMoney || isValidMzMsisdn(effectivePayPhone);
  const homeValid =
    method === 'pickup' || (province !== '' && district.trim() !== '' && bairro.trim() !== '');
  const nameValid = name.trim() !== '';

  const formValid = nameValid && phoneValid && payPhoneValid && homeValid;

  if (items.length === 0) {
    return (
      <div className="empty" role="status">
        <h1 className="section__title">{pt.cart.empty_title}</h1>
        <p>{t.empty}</p>
        <a className="btn btn--cta" href="/" style={{ maxWidth: 220 }}>
          {pt.cart.empty_cta}
        </a>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!formValid) {
      // Move focus to the first error for keyboard/screen-reader users.
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const ref = makeOrderRef();
    saveDemoOrder({
      ref,
      placedAt: new Date().toISOString(),
      name: name.trim(),
      phone,
      email: email.trim(),
      deliveryMethod: method,
      address:
        method === 'home'
          ? {
              province,
              district: district.trim(),
              bairro: bairro.trim(),
              landmark: landmark.trim(),
              house: house.trim(),
            }
          : null,
      paymentMethod: payment,
      payWallet: isMobileMoney ? (WALLET_LABEL[payment] ?? null) : null,
      items,
      itemsTotalCents: totalCents,
    });
    clear();
    router.push(`/pedido/${ref}`);
  }

  const err = (id: string, show: boolean, msg: string) =>
    show ? (
      <span className="field__error" id={id} role="alert">
        {msg}
      </span>
    ) : null;

  return (
    <form className="checkout" onSubmit={onSubmit} noValidate>
      <h1 className="section__title">{t.title}</h1>
      <p className="demo-banner" role="note">
        {t.demo_banner}
      </p>

      <div className="checkout__grid">
        <div className="checkout__main">
          {/* Contact */}
          <fieldset className="card">
            <legend className="card__title">{t.contact_title}</legend>

            <label className="field">
              <span className="field__label">
                {t.name_label} <span aria-hidden="true">*</span>
              </span>
              <input
                className="field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.name_ph}
                autoComplete="name"
                required
                aria-invalid={submitted && !nameValid}
              />
            </label>

            <label className="field">
              <span className="field__label">
                {t.phone_label} <span aria-hidden="true">*</span>
              </span>
              <input
                className="field__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="84 123 4567"
                inputMode="tel"
                autoComplete="tel"
                required
                aria-invalid={submitted && !phoneValid}
                aria-describedby="phone-hint phone-err"
              />
              <span className="field__hint" id="phone-hint">
                {t.phone_hint}
              </span>
              {err('phone-err', submitted && !phoneValid, t.phone_invalid)}
            </label>

            <label className="field">
              <span className="field__label">{t.email_label}</span>
              <input
                className="field__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.email_ph}
                autoComplete="email"
              />
            </label>
          </fieldset>

          {/* Delivery */}
          <fieldset className="card">
            <legend className="card__title">{t.delivery_title}</legend>

            <div className="radio-cards" role="radiogroup" aria-label={t.delivery_title}>
              <label className={`radio-card ${method === 'home' ? 'radio-card--on' : ''}`}>
                <input
                  type="radio"
                  name="delivery"
                  checked={method === 'home'}
                  onChange={() => setMethod('home')}
                />
                <span className="radio-card__title">{t.method_home}</span>
                <span className="radio-card__note">{t.method_home_note}</span>
              </label>
              <label className={`radio-card ${method === 'pickup' ? 'radio-card--on' : ''}`}>
                <input
                  type="radio"
                  name="delivery"
                  checked={method === 'pickup'}
                  onChange={() => setMethod('pickup')}
                />
                <span className="radio-card__title">{t.method_pickup}</span>
                <span className="radio-card__note">{t.method_pickup_note}</span>
              </label>
            </div>

            {method === 'home' ? (
              <div className="field-group">
                <label className="field">
                  <span className="field__label">
                    {t.province_label} <span aria-hidden="true">*</span>
                  </span>
                  <select
                    className="field__input"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                    aria-invalid={submitted && method === 'home' && province === ''}
                  >
                    <option value="">{t.province_ph}</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">
                    {t.district_label} <span aria-hidden="true">*</span>
                  </span>
                  <input
                    className="field__input"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder={t.district_ph}
                    required
                    aria-invalid={submitted && method === 'home' && district.trim() === ''}
                  />
                </label>

                <label className="field">
                  <span className="field__label">
                    {t.bairro_label} <span aria-hidden="true">*</span>
                  </span>
                  <input
                    className="field__input"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder={t.bairro_ph}
                    required
                    aria-invalid={submitted && method === 'home' && bairro.trim() === ''}
                  />
                </label>

                <label className="field">
                  <span className="field__label">{t.landmark_label}</span>
                  <input
                    className="field__input"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder={t.landmark_ph}
                  />
                </label>

                <label className="field">
                  <span className="field__label">{t.house_label}</span>
                  <input
                    className="field__input"
                    value={house}
                    onChange={(e) => setHouse(e.target.value)}
                    placeholder={t.house_ph}
                  />
                </label>
              </div>
            ) : null}
          </fieldset>

          {/* Payment */}
          <fieldset className="card">
            <legend className="card__title">{t.payment_title}</legend>

            <div
              className="radio-cards radio-cards--pay"
              role="radiogroup"
              aria-label={t.payment_title}
            >
              <PayCard
                id="mpesa"
                cur={payment}
                set={setPayment}
                title={t.pay_mpesa}
                note={t.pay_mpesa_note}
              />
              <PayCard
                id="emola"
                cur={payment}
                set={setPayment}
                title={t.pay_emola}
                note={t.pay_emola_note}
              />
              <PayCard
                id="mkesh"
                cur={payment}
                set={setPayment}
                title={t.pay_mkesh}
                note={t.pay_mkesh_note}
              />
              <PayCard
                id="cod"
                cur={payment}
                set={setPayment}
                title={t.pay_cod}
                note={t.pay_cod_note}
              />
            </div>

            {isMobileMoney ? (
              <label className="field" style={{ marginTop: 'var(--space-3)' }}>
                <span className="field__label">
                  {t.pay_phone_label} <span aria-hidden="true">*</span>
                </span>
                <input
                  className="field__input"
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  placeholder={phone || '84 123 4567'}
                  inputMode="tel"
                  aria-invalid={submitted && !payPhoneValid}
                  aria-describedby="pay-hint pay-err"
                />
                <span className="field__hint" id="pay-hint">
                  {t.pay_phone_hint}
                </span>
                {suggestedWallet ? (
                  <span className="field__hint field__hint--suggest">
                    {t.suggested}: <strong>{WALLET_LABEL[suggestedWallet]}</strong>
                  </span>
                ) : null}
                {err('pay-err', submitted && !payPhoneValid, t.phone_invalid)}
              </label>
            ) : null}
          </fieldset>
        </div>

        {/* Summary — total before confirm */}
        <aside className="checkout__summary" aria-label={t.summary_title}>
          <h2 className="card__title">{t.summary_title}</h2>

          <ul className="sumlist">
            {items.map((it) => (
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

          <div className="sumrow">
            <span>{t.summary_items}</span>
            <span>{formatMZN(cents(totalCents))}</span>
          </div>
          <div className="sumrow sumrow--muted">
            <span>{t.summary_delivery}</span>
            <span>{method === 'pickup' ? t.summary_delivery_free : t.summary_delivery_tbc}</span>
          </div>
          <div className="sumrow sumrow--total">
            <span>{t.summary_total}</span>
            <span className="price__now">{formatMZN(cents(totalCents))}</span>
          </div>
          {method === 'home' ? <p className="sumnote">{t.summary_total_note}</p> : null}

          {submitted && !formValid ? (
            <p className="field__error" role="alert">
              {t.required}
            </p>
          ) : null}

          <button type="submit" className="btn btn--cta">
            {t.place_order}
          </button>
        </aside>
      </div>
    </form>
  );
}

function PayCard({
  id,
  cur,
  set,
  title,
  note,
}: {
  id: PaymentMethod;
  cur: PaymentMethod;
  set: (p: PaymentMethod) => void;
  title: string;
  note: string;
}) {
  return (
    <label className={`radio-card ${cur === id ? 'radio-card--on' : ''}`}>
      <input type="radio" name="payment" checked={cur === id} onChange={() => set(id)} />
      <span className="radio-card__title">{title}</span>
      <span className="radio-card__note">{note}</span>
    </label>
  );
}
