'use client';
import { useState } from 'react';
import { isValidMzMsisdn } from '@nhonga/shared';
import { useDict } from '../i18n/DictProvider';
import { useSession } from './SessionProvider';

/**
 * Confirms a phone number on an account that has none (one opened with Google
 * or Facebook): number, then the SMS code (AUTH-10). Buyers reach sellers by
 * phone, so this is asked before the first listing.
 */
export function PhoneConfirm({ onDone }: { onDone?: () => void }) {
  const t = useDict().phoneConfirm;
  const { refresh } = useSession();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [devCode, setDevCode] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, string | undefined>;
    return { ok: res.ok, data };
  }

  async function requestCode(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    if (!isValidMzMsisdn(phone)) {
      setError(t.invalid);
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await post('/api/auth/phone/request', { phone });
      if (!ok || !data['challengeId']) {
        setError(data['message'] ?? t.failed);
        return;
      }
      setChallengeId(data['challengeId']);
      setDevCode(data['devCode'] ?? '');
      setStep('code');
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.SyntheticEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { ok, data } = await post('/api/auth/phone/verify', { challengeId, code: code.trim() });
      if (!ok) {
        setError(data['message'] ?? t.failed);
        return;
      }
      await refresh();
      onDone?.();
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card phoneconfirm">
      <h2 className="card__title">{t.title}</h2>
      <p className="account__muted">{t.body}</p>
      {step === 'phone' ? (
        <form onSubmit={requestCode} noValidate>
          <label className="field">
            <span className="field__label">{t.phone_label}</span>
            <input
              className="field__input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="84 123 4567"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={error !== ''}
            />
          </label>
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? t.sending : t.send}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          <p className="account__muted">{t.sent_to.replace('{phone}', phone)}</p>
          {devCode ? (
            <p className="auth__notice" role="status">
              {t.dev_code}: <strong>{devCode}</strong>
            </p>
          ) : null}
          <label className="field">
            <span className="field__label">{t.code_label}</span>
            <input
              className="field__input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-invalid={error !== ''}
            />
          </label>
          {error ? (
            <p className="field__error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || code.trim().length < 4}
          >
            {busy ? t.checking : t.confirm}
          </button>{' '}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError('');
            }}
          >
            {t.change}
          </button>
        </form>
      )}
    </div>
  );
}
