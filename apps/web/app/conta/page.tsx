'use client';
import { useState } from 'react';
import { pt } from '../../lib/i18n/pt';
import { readDemoOrder } from '../../lib/order-types';
import { IconUser, IconCart, IconShield, IconChevronLeft } from '../../components/icons';

// Guest-friendly account. Accounts are not wired yet, so this is honest about
// its guest state: it offers sign-in (to /entrar), and lets a guest look up the
// demo order they placed on this device by its reference. No fabricated
// "signed-in" state, no invented saved data.
export default function AccountPage() {
  const t = pt.account;
  const [ref, setRef] = useState('');
  const [result, setResult] = useState<'idle' | 'found' | 'missing'>('idle');
  const [foundRef, setFoundRef] = useState('');

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    const clean = ref.trim().toUpperCase();
    if (clean === '') return;
    const order = readDemoOrder(clean);
    if (order) {
      setFoundRef(clean);
      setResult('found');
    } else {
      setResult('missing');
    }
  }

  return (
    <section className="account">
      <h1 className="section__title">{t.title}</h1>
      <p className="demo-banner" role="note">
        {t.demo_note}
      </p>

      <div className="account__grid">
        {/* Sign-in prompt */}
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

        {/* Order tracking */}
        <form className="card" onSubmit={lookup}>
          <h2 className="card__title">{t.track_title}</h2>
          <p className="account__muted">{t.track_body}</p>
          <label className="field">
            <span className="sr-only">{t.track_title}</span>
            <input
              className="field__input"
              value={ref}
              onChange={(e) => {
                setRef(e.target.value);
                setResult('idle');
              }}
              placeholder={t.track_ph}
              inputMode="text"
              aria-describedby="track-msg"
            />
          </label>
          <button type="submit" className="btn btn--primary">
            {t.track_cta}
          </button>

          <div id="track-msg" aria-live="polite">
            {result === 'found' ? (
              <a className="account__found" href={`/pedido/${foundRef}`}>
                {t.track_view}: <strong>{foundRef}</strong> →
              </a>
            ) : result === 'missing' ? (
              <p className="field__error" role="alert">
                {t.track_not_found}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      {/* Shortcuts */}
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
        <a className="account__link" href="/vender">
          <IconUser width={20} height={20} />
          <span>{t.link_sell}</span>
          <IconChevronLeft width={16} height={16} className="account__link-arrow" />
        </a>
      </nav>
    </section>
  );
}
