'use client';
import { useState } from 'react';
import { pt } from '../../lib/i18n/pt';
import { IconGoogle, IconFacebook } from '../../components/icons';

// Sign in / register. Authentication is NOT wired: there is no OAuth backend
// and no token exchange, and real social login must exchange and verify tokens
// server-side (never with a client secret in the browser). So this screen is
// the correct UI, but it authenticates nothing — no password is transmitted or
// stored, and the provider buttons do not start a fake provider flow. Every
// action surfaces an honest "not available in this demo" message.
type Mode = 'signin' | 'register';
type Method = 'email' | 'phone';

export default function AuthPage() {
  const t = pt.auth;
  const [mode, setMode] = useState<Mode>('signin');
  const [method, setMethod] = useState<Method>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [notice, setNotice] = useState(false);

  const notWired = () => setNotice(true);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Deliberately does not authenticate. Nothing is sent or persisted.
    setPassword('');
    notWired();
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <h1 className="auth__title">{mode === 'signin' ? t.title_signin : t.title_register}</h1>
        <p className="auth__subtitle">{t.subtitle}</p>

        {/* Social — brand-correct buttons; non-functional in this demo */}
        <div className="auth__social">
          <button type="button" className="social-btn social-btn--google" onClick={notWired}>
            <IconGoogle />
            <span>{t.google}</span>
          </button>
          <button type="button" className="social-btn social-btn--facebook" onClick={notWired}>
            <IconFacebook />
            <span>{t.facebook}</span>
          </button>
        </div>

        <div className="auth__divider" role="separator">
          <span>{t.or}</span>
        </div>

        <form onSubmit={onSubmit} noValidate>
          {mode === 'register' ? (
            <label className="field">
              <span className="field__label">{t.name_label}</span>
              <input
                className="field__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.name_ph}
                autoComplete="name"
              />
            </label>
          ) : null}

          {method === 'email' ? (
            <>
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
              <label className="field">
                <span className="field__label">{t.password_label}</span>
                <input
                  className="field__input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.password_ph}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </label>
              <button type="submit" className="btn btn--cta auth__submit">
                {mode === 'signin' ? t.submit_signin : t.submit_register}
              </button>
              <button
                type="button"
                className="auth__method-toggle"
                onClick={() => setMethod('phone')}
              >
                {t.phone_toggle}
              </button>
            </>
          ) : (
            <>
              <label className="field">
                <span className="field__label">{t.phone_label}</span>
                <input
                  className="field__input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phone_ph}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <button type="submit" className="btn btn--cta auth__submit">
                {t.send_code}
              </button>
              <button
                type="button"
                className="auth__method-toggle"
                onClick={() => setMethod('email')}
              >
                {t.email_toggle}
              </button>
            </>
          )}
        </form>

        {notice ? (
          <p className="auth__notice" role="alert">
            {t.not_wired}
          </p>
        ) : null}

        <p className="auth__terms">{t.terms}</p>
        <p className="demo-banner" role="note">
          {t.demo_note}
        </p>

        <button
          type="button"
          className="auth__switch"
          onClick={() => {
            setMode(mode === 'signin' ? 'register' : 'signin');
            setNotice(false);
          }}
        >
          {mode === 'signin' ? t.switch_to_register : t.switch_to_signin}
        </button>
      </div>
    </section>
  );
}
