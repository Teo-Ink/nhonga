'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isValidMzMsisdn } from '@nhonga/shared';
import { pt } from '../../lib/i18n/pt';
import { IconGoogle, IconFacebook, IconChevronLeft } from '../../components/icons';
import { useSession } from '../../components/auth/SessionProvider';

// Sign in / register via phone OTP — the real, wired flow. Social sign-in stays
// a labelled demo (it needs server-side OAuth token exchange that is not set up).
type Step = 'phone' | 'code';

export default function AuthPage() {
  const t = pt.auth;
  const router = useRouter();
  const { refresh } = useSession();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [socialNotice, setSocialNotice] = useState(false);

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
      router.push('/conta');
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
            </form>

            <div className="auth__divider" role="separator">
              <span>{t.social_or}</span>
            </div>
            <div className="auth__social">
              <button
                type="button"
                className="social-btn social-btn--google"
                onClick={() => setSocialNotice(true)}
              >
                <IconGoogle />
                <span>{t.google}</span>
              </button>
              <button
                type="button"
                className="social-btn social-btn--facebook"
                onClick={() => setSocialNotice(true)}
              >
                <IconFacebook />
                <span>{t.facebook}</span>
              </button>
            </div>
            {socialNotice ? (
              <p className="auth__notice" role="alert">
                {t.not_wired}
              </p>
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

        <p className="demo-banner" role="note">
          {t.demo_note}
        </p>
      </div>
    </section>
  );
}
