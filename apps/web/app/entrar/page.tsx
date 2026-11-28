'use client';
import { IS_DEMO } from '../../lib/demo';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidMzMsisdn } from '@nhonga/shared';
import { pt } from '../../lib/i18n/pt';
import { IconGoogle, IconFacebook, IconChevronLeft } from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';

// Sign in / register with the phone number (SMS code), Google or Facebook.
// The Google/Facebook buttons appear only for providers that are configured
// on the server; each is a plain link to our own /api/auth/social/... route,
// which sends the browser to the provider (AUTH-10).
type Step = 'phone' | 'code';

export default function AuthPage() {
  const t = pt.auth;
  const router = useRouter();
  const { refresh, user, loading } = useSession();

  // After sign-in, continue to `?next=` (internal paths only) or the account.
  const destination = (): string => {
    if (typeof window === 'undefined') return '/conta';
    const next = new URLSearchParams(window.location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : '/conta';
  };

  // Already signed in? Skip the form and go straight to the destination.
  useEffect(() => {
    if (!loading && user) router.replace(destination());
  }, [loading, user, router]);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<string[]>([]);
  const [next, setNext] = useState('/conta');

  useEffect(() => {
    setNext(destination());
    const erro = new URLSearchParams(window.location.search).get('erro');
    if (erro === 'suspensa') setError(t.social_suspended);
    else if (erro) setError(t.social_failed);
    fetch('/api/auth/social/providers')
      .then((r) => r.json())
      .then((d: { providers?: string[] }) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, []);
  const socialHref = (provider: string) =>
    `/api/auth/social/${provider}/start?next=${encodeURIComponent(next)}`;

  const phoneValid = isValidMzMsisdn(phone);

  async function requestCode(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    if (!phoneValid) {
      setError(t.phone_invalid);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        challengeId?: string;
        devCode?: string;
        message?: string;
        detail?: string;
      };
      if (!res.ok || !data.challengeId) {
        setError(data.detail ?? data.message ?? t.error_generic);
        return;
      }
      setChallengeId(data.challengeId);
      setDevCode(data.devCode ?? '');
      setStep('code');
    } catch {
      setError(t.error_generic);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (code.trim().length !== 6) {
      setError(t.code_required);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId, code: code.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { user?: unknown; message?: string };
      if (!res.ok || !data.user) {
        setError(data.message ?? t.error_generic);
        return;
      }
      await refresh();
      router.push(destination());
    } catch {
      setError(t.error_generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <div className="auth__card">
        <h1 className="auth__title">{t.otp_title}</h1>

        {step === 'phone' ? (
          <>
            <p className="auth__subtitle">{t.otp_subtitle}</p>
            <form onSubmit={requestCode} noValidate>
              <label className="field">
                <span className="field__label">{t.phone_label}</span>
                <input
                  className="field__input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t.phone_ph}
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={error !== '' && !phoneValid}
                  autoFocus
                />
                <span className="field__hint">{t.phone_hint}</span>
              </label>
              {error ? (
                <p className="field__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="btn btn--cta auth__submit" disabled={busy}>
                {busy ? t.sending : t.send_code}
              </button>
              <p className="auth__legal">
                {t.legal_before} <a href="/termos">{t.legal_terms}</a> {t.legal_and}{' '}
                <a href="/privacidade">{t.legal_privacy}</a>.
              </p>
            </form>

            {providers.length > 0 ? (
              <>
                <div className="auth__divider" role="separator">
                  <span>{t.social_or}</span>
                </div>
                <div className="auth__social">
                  {providers.includes('google') ? (
                    <a className="social-btn social-btn--google" href={socialHref('google')}>
                      <IconGoogle />
                      <span>{t.google}</span>
                    </a>
                  ) : null}
                  {providers.includes('facebook') ? (
                    <a className="social-btn social-btn--facebook" href={socialHref('facebook')}>
                      <IconFacebook />
                      <span>{t.facebook}</span>
                    </a>
                  ) : null}
                </div>
                <p className="auth__legal">{t.social_note}</p>
              </>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="pdp__back"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
            >
              <IconChevronLeft /> {t.change_phone}
            </button>
            <h2 className="card__title" style={{ marginTop: 'var(--space-2)' }}>
              {t.code_title}
            </h2>
            <p className="auth__subtitle" style={{ marginTop: 0 }}>
              {t.code_sent_to.replace('{phone}', phone)}
            </p>
            {devCode ? (
              <p className="auth__notice" role="status">
                {t.dev_code}: <strong>{devCode}</strong>
              </p>
            ) : null}
            <form onSubmit={verify} noValidate>
              <label className="field">
                <span className="field__label">{t.code_label}</span>
                <input
                  className="field__input auth__code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t.code_ph}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-invalid={error !== ''}
                  autoFocus
                />
              </label>
              {error ? (
                <p className="field__error" role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="btn btn--cta auth__submit" disabled={busy}>
                {busy ? t.verifying : t.verify}
              </button>
            </form>
            <button
              type="button"
              className="auth__method-toggle"
              onClick={requestCode}
              disabled={busy}
            >
              {t.resend}
            </button>
          </>
        )}

        {IS_DEMO ? (
          <p className="demo-banner" role="note">
            {t.demo_note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
